import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as url from 'url';
import { exec } from 'child_process';
import { fetch } from '@whatwg-node/fetch';
import * as core from '@actions/core';

const GIT_SECRET_VER = 'v0.5.0';
const GIT_SECRET_DIR = path.join(os.tmpdir(), `git-secret_${GIT_SECRET_VER}`);
const GIT_SECRET_BIN = path.join(GIT_SECRET_DIR, 'git-secret');

const SECRETS_DIR = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)), // __dirname
  'secrets',
);

async function main() {
  try {
    await fs.stat(GIT_SECRET_BIN);
    console.debug(`git-secret@${GIT_SECRET_VER} already installed`);
  } catch {
    await install();
  }

  const gpgKey = core.getInput('gpg-key');
  if (gpgKey) {
    await sh(`echo -n "${gpgKey}" | gpg --import`, 'gpg --import');
  }

  console.debug('Removing already revealed secrets');
  for (const file of await fs.readdir(SECRETS_DIR)) {
    if (!file.endsWith('.secret')) {
      // remove all non-secrets (cleanup if running on local machine)
      await fs.rm(path.join(SECRETS_DIR, file));
    }
  }

  console.log('Processing secrets');
  await sh(`${GIT_SECRET_BIN} reveal`);
  for (const file of await fs.readdir(SECRETS_DIR)) {
    if (!file.endsWith('.secret')) {
      const secretBuf = await fs.readFile(path.join(SECRETS_DIR, file));
      const secret = secretBuf.toString();
      core.setSecret(secret);
      core.setOutput(`secrets.${file}`, secret);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

//

/**
 * Installs git-secret into the GIT_SECRET_DIR.
 */
async function install() {
  console.info(`Installing git-secret@${GIT_SECRET_VER}`);

  try {
    console.info(`Removing ${GIT_SECRET_DIR}`);
    await fs.rm(GIT_SECRET_DIR, { recursive: true });
  } catch (err) {
    if (!String(err).includes('ENOENT')) {
      throw err;
    }
  }

  console.info(`Making ${GIT_SECRET_DIR}`);
  await fs.mkdir(GIT_SECRET_DIR);

  console.info(`Downloading into ${GIT_SECRET_DIR}`);
  const res = await fetch(
    `https://github.com/sobolevn/git-secret/archive/refs/tags/${GIT_SECRET_VER}.tar.gz`,
  );
  if (!res.ok) {
    throw new Error('Unable to download');
  }

  const archive = path.join(GIT_SECRET_DIR, 'archive.tar.gz');
  await fs.writeFile(archive, Buffer.from(await res.arrayBuffer()));

  await sh(`tar -xf ${archive} -C ${GIT_SECRET_DIR} --strip-components=1`);

  await sh(`make -C ${GIT_SECRET_DIR} build`);

  try {
    await fs.stat(GIT_SECRET_BIN);
  } catch {
    throw new Error(`git-secret binary does not exist`);
  }
}

/**
 * Gets the GitHub Actions input and parses it as an array.
 *
 * Reference: https://github.com/actions/cache/blob/515d10b4fd9bb4858066bd5769f55bd498dcdd27/src/utils/actionUtils.ts#L49-L58
 *
 * @param {string} name
 * @param {core.InputOptions=} options
 */
export function getInputAsArray(name, options) {
  return core
    .getInput(name, options)
    .split('\n')
    .map((s) => s.trim())
    .filter((x) => x !== '');
}

/**
 * Execute a shell command.
 *
 * @param {string} cmd
 * @param {string=} cmdToLog The command to log in case the `cmd` is too long or contains sensitive data.
 */
async function sh(cmd, cmdToLog) {
  console.debug(`$ ${cmdToLog || cmd}`);
  await new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(err);
      if (stderr) {
        if (
          // TODO: successful "gpg --import" command writes to stderr 🤦‍♂️
          stderr.includes('secret key imported')
        ) {
          console.debug(`> ${stderr}`);
        } else {
          return reject(stderr);
        }
      }
      if (stdout) console.debug(`> ${stdout}`);
      resolve(void 0);
    });
  });
}
