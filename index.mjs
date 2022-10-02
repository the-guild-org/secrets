import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { fetch } from '@whatwg-node/fetch';
import * as core from '@actions/core';

const GIT_SECRET_VER = 'v0.5.0';
const GIT_SECRET_DIR = path.join(os.tmpdir(), `git-secret_${GIT_SECRET_VER}`);
const GIT_SECRET_BIN = path.join(GIT_SECRET_DIR, 'git-secret');

const SECRETS_REPO = 'https://github.com/the-guild-org/secrets.git';

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

  console.info('Cloning secrets');
  const secretsRepoDir = path.join(os.tmpdir(), 'the-guild-org-secrets');
  try {
    console.debug(`Removing ${secretsRepoDir}`);
    await fs.rm(secretsRepoDir, { recursive: true });
  } catch (err) {
    if (!String(err).includes('ENOENT')) {
      throw err;
    }
  }
  await fs.mkdir(secretsRepoDir);
  await sh(`git clone ${SECRETS_REPO} ${secretsRepoDir} --depth=1`);

  console.info('Processing secrets');
  await sh(`cd ${secretsRepoDir} && ${GIT_SECRET_BIN} reveal`);
  const secretsDir = path.join(secretsRepoDir, 'secrets');
  for (const file of await fs.readdir(secretsDir)) {
    if (!file.endsWith('.secret')) {
      const secretBuf = await fs.readFile(path.join(secretsDir, file));
      const secret = secretBuf.toString();
      core.setSecret(secret);
      core.setOutput(file, secret);
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
    console.debug(`Removing ${GIT_SECRET_DIR}`);
    await fs.rm(GIT_SECRET_DIR, { recursive: true });
  } catch (err) {
    if (!String(err).includes('ENOENT')) {
      throw err;
    }
  }

  await fs.mkdir(GIT_SECRET_DIR);
  const archive = path.join(GIT_SECRET_DIR, 'archive.tar.gz');
  console.debug(`Downloading into ${archive}`);
  const res = await fetch(
    `https://github.com/sobolevn/git-secret/archive/refs/tags/${GIT_SECRET_VER}.tar.gz`,
  );
  if (!res.ok) {
    throw new Error(
      `Unable to download. Got response ${res.status}: ${res.statusText}`,
    );
  }
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
      if (stdout) console.debug(`1> ${stdout}`);
      if (stderr) console.debug(`2> ${stderr}`);
      resolve(void 0);
    });
  });
}
