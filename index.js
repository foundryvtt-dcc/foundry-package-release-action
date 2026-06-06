// noinspection JSUnresolvedFunction,JSIgnoredPromiseFromCall

const core = require('@actions/core')
const github = require('@actions/github')


const actionToken = core.getInput('actionToken')
const dryRun = core.getInput('dryRun')
const foundryToken = core.getInput('foundryToken')
const manifestFileName = core.getInput('manifestFileName')
const octokit = github.getOctokit(actionToken)
const owner = github.context.payload.repository.owner.login
const repo = github.context.payload.repository.name

async function updatePackage() {
    try {
        // Download release
        const latestRelease = await octokit.rest.repos.getLatestRelease({
            owner: owner,
            repo: repo,
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

        // The Foundry package id comes from the manifest, not the GitHub repo
        // name — they can differ (e.g. repo "fvtt-condition-lab" vs package
        // "condition-lab"). Sending the wrong id yields a 403 from Foundry.
        const packageId = manifestFileData.id || repo
        console.debug(packageId)

        const compatibilityMaxFromManifest = manifestFileData.compatibility?.maximum
        console.debug(compatibilityMaxFromManifest)

        const compatibilityMinFromManifest = manifestFileData.compatibility?.minimum
        console.debug(compatibilityMinFromManifest)

        const compatibilityVerifiedFromManifest = manifestFileData.compatibility?.verified
        console.debug(compatibilityVerifiedFromManifest)

        let releaseNotesUrl = latestRelease?.data?.html_url
        if (!releaseNotesUrl) {
            releaseNotesUrl = `https://github.com/${owner}/${repo}/releases/tag/v${version}`
        }
        console.debug(releaseNotesUrl)

        console.debug("Dry Run")
        const dryRunBoolean = dryRun.toLowerCase() === 'true'
        console.debug(dryRun)
        console.debug(dryRunBoolean)

        const foundryResponse = await fetch("https://api.foundryvtt.com/_api/packages/release_version/", {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': foundryToken
            },
            method: "POST",
            body: JSON.stringify({
                "id": packageId,
                "dry-run": dryRunBoolean,
                "release": {
                    "version": version,
                    "manifest": manifestFileData.manifest,
                    "notes": releaseNotesUrl,
                    "compatibility": {
                        "minimum": compatibilityMinFromManifest,
                        "verified": compatibilityVerifiedFromManifest,
                        "maximum": compatibilityMaxFromManifest
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
            core.setFailed(foundryResponse.statusText)
        }

    } catch (error) {
        core.setFailed(error.message)
    }
}

async function run() {
    try {
        // Validate manifestFileName
        if (manifestFileName !== 'system.json' && manifestFileName !== 'module.json')
            core.setFailed('manifestFileName must be system.json or module.json')

        await updatePackage()

    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
