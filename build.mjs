import { build } from 'esbuild';

build({
  entryPoints: ['.'],
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.mjs',
  banner: {
    // https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
    js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
  },
});
