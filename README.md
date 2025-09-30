# GitHub Action to Update FoundryVTT.com Website after a Release is Published

This GitHub Action updates the foundryvtt.com website with a new version of a package after a GitHub release is published.

This is to be used with the `foundry-release-action`, and runs after a release is published to copy the manifest into main with the latest version information.

## Install Instructions

Create a folder named `.github` at the root of your workflow, and inside that folder, create a `workflows` folder.

In the `workflows` folder, create a file named `foundry_manifest_update.yml` with this content:

```
name: Foundry Website Update

on:
  release:
    types:
      - published

jobs:
  update_foundry_website_post_release:
    runs-on: ubuntu-latest
    name: Foundry Website Update
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          ref: main

      - name: Foundry Website Update
        id: foundry-website-update
        uses: foundryvtt-dcc/foundry-package-release-action@main
        with:
          actionToken: ${{ secrets.GITHUB_TOKEN }}
          manifestFileName: 'system.json'
          foundryToken: ${{ secrets.FOUNDRY_PACKAGE_RELEASE_TOKEN }}
          dryRun: false
```

For `manifestFileName` you will enter `module.json` or `system.json` depending on your project.

For `foundryToken` - the package release token that can be found on the package's page on the Foundry website:
`https://foundryvtt.com/packages/<MY-PACKAGE-SLUG>/edit`

It should be added as a GitHub secret to the repo running this action.

For `dryRun` - this is an indicator to the Foundry website that this is a dry run and not to actually update.

This action expects the slug of the GitHub repo to match the package name on the Foundry Website.

API Docs are here: https://foundryvtt.com/article/package-release-api/

You should not need to change `token` or `actionToken` from the example above.
