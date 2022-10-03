# The Guild Secrets

Collection of shared secrets from [The Guild](https://the-guild.dev/) for local and CI usage.

## Usage

Make sure to have [git-secret](https://git-secret.io/) and [GnuPG](https://gnupg.org/) installed.

### Reveal secrets

1. `git secret reveal`
1. Revealed secrets are files inside the [secrets/](secrets/) folder without the `.secret` extension

### Hide secrets

1. `git secret hide`
1. Hidden secrets are files inside the [secrets/](secrets/) folder with the `.secret` extension

### Add new secret

1. [Reveal secrets](#reveal-secrets)
1. Create a new file inside [secrets/](secrets/)
1. Make sure the filename (because the filename _is_ the secret name):
   1. Has no spaces
   1. Has illegal characters
   1. Has no extension
1. Write the secret inside the contents of the file
1. `git secret add <filepath>`
1. [Hide secrets](#hide-secrets)

### Remove secret

1. [Reveal secrets](#reveal-secrets)
1. `git secret remove <filepath>`
1. [Hide secrets](#hide-secrets)

### Give access to user

Make sure you have obtained the GPG key from the user.

1. [Reveal secrets](#reveal-secrets)
1. Import the obtained GPG key
1. `git secret tell <email>`
1. [Hide secrets](#hide-secrets)

### Use in GitHub Actions

Simply add a job step that `uses` [the-guild-org/secrets](https://github.com/the-guild-org/secrets) and provide the GPG key that has access to the secrets through the `gpg-key` input.

The revealed secrets will be a part of the job step's output, for example: `steps.secrets.outputs.<filename>`.

```yml
jobs:
  publish:
    name: Publish
    runs-on: ubuntu-latest
    steps:
      - name: The Guild Secrets
        id: secrets
        uses: the-guild-org/secrets@main
        with:
          gpg-key: ${{ secrets.GPG_KEY }}
      - name: Publish
        env:
          NPM_TOKEN: ${{ steps.secrets.outputs.NPM_TOKEN }}
        run: npm publish
```
