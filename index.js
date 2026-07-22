// noinspection JSUnresolvedFunction,JSIgnoredPromiseFromCall

import * as core from '@actions/core'
import * as github from '@actions/github'

const actionToken = core.getInput('actionToken')
const dryRun = core.getInput('dryRun')
const foundryToken = core.getInput('foundryToken')
const manifestFileName = core.getInput('manifestFileName')
const publicRepositoryAndBranch = core.getInput('publicRepositoryAndBranch') || 'foundryvtt-dcc/dcc-content/main'
const octokit = github.getOctokit(actionToken)
const owner = github.context.payload.repository.owner.login
const repo = github.context.payload.repository.name

async function updatePackage () {
  try {
    // Download release
    const latestRelease = await octokit.rest.repos.getLatestRelease({
      owner,
      repo
    })
    // console.log(latestRelease.data.assets)

    // Get the Asset ID of the version file from the release info
    let assetID = 0
    for (const item of latestRelease.data.assets) {
      if (item.name === manifestFileName) {
        assetID = item.id
      }
    }
    if (assetID === 0) {
      console.log(latestRelease)
      core.setFailed('No AssetID for manifest file')
    }

    const manifestAssetUrl = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetID}`
    console.debug(manifestAssetUrl)

    const manifestAssetResponse = await fetch(manifestAssetUrl, {
      headers: {
        Authorization: `token ${actionToken}`, Accept: 'application/octet-stream'
      }
    })
    // console.log(manifestAssetResponse)
    const manifestFileData = await manifestAssetResponse.json()
    console.log(manifestFileData)

    const version = manifestFileData.version
    console.debug(version)

    const compatibilityMaxFromManifest = manifestFileData.compatibility?.maximum
    console.debug(compatibilityMaxFromManifest)

    const compatibilityMinFromManifest = manifestFileData.compatibility?.minimum
    console.debug(compatibilityMinFromManifest)

    const compatibilityVerifiedFromManifest = manifestFileData.compatibility?.verified
    console.debug(compatibilityVerifiedFromManifest)

    let releaseNotesUrl = `https://github.com/${owner}/${repo}/releases/tag/v${version}`
    if (manifestFileName === 'module.json') {
      const [contentOwner, contentRepo, ...contentBranch] = publicRepositoryAndBranch.split('/')
      releaseNotesUrl = `https://github.com/${contentOwner}/${contentRepo}/blob/${contentBranch.join('/')}/${repo}/v${version}/RELEASE_NOTES.md`
    }
    console.debug(releaseNotesUrl)

    console.debug('Dry Run')
    const dryRunBoolean = dryRun.toLowerCase() === 'true'
    console.debug(dryRun)
    console.debug(dryRunBoolean)

    // Foundry's Release API expects a VERSION-SPECIFIC manifest URL — not the
    // package's own `manifest` field, which now points at a stable "latest" URL
    // for ongoing update detection. Reconstruct the per-version URL here.
    // Protected packages are auto-detected from the released manifest itself
    // (their asset carries `protected: true`); their source repo is private, so
    // the public versioned mirror in the content repo is used instead of the
    // GitHub release asset.
    let releaseManifestUrl = `https://github.com/${owner}/${repo}/releases/download/v${version}/${manifestFileName}`
    if (manifestFileData.protected === true) {
      releaseManifestUrl = `https://raw.githubusercontent.com/${publicRepositoryAndBranch}/${repo}/v${version}/${manifestFileName}`
    }
    console.debug(releaseManifestUrl)

    // NOTE: must be foundryvtt.com, NOT api.foundryvtt.com. The old lambda host
    // (api.foundryvtt.com) registers the version but does NOT update Foundry's
    // package cache, so the in-app installer never advances to the new version
    // (confirmed by Foundry support 2026-06-18). foundryvtt.com updates the cache.
    const foundryResponse = await fetch('https://foundryvtt.com/_api/packages/release_version/', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: foundryToken
      },
      method: 'POST',
      body: JSON.stringify({
        id: repo,
        'dry-run': dryRunBoolean,
        release: {
          version,
          manifest: releaseManifestUrl,
          notes: releaseNotesUrl,
          compatibility: {
            minimum: compatibilityMinFromManifest,
            verified: compatibilityVerifiedFromManifest,
            maximum: compatibilityMaxFromManifest
          }
        }
      })
    })
    console.log(foundryResponse)
    if (foundryResponse.status === 200) {
      const foundryResponseData = await foundryResponse.json()
      console.log(foundryResponse.statusText)
      console.debug(foundryResponseData)
    } else {
      const errorBody = await foundryResponse.text()
      console.log(errorBody)
      core.setFailed(`${foundryResponse.statusText}: ${errorBody}`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function run () {
  try {
    // Validate manifestFileName
    if (manifestFileName !== 'system.json' && manifestFileName !== 'module.json') { core.setFailed('manifestFileName must be system.json or module.json') }

    await updatePackage()
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
