import { resolveReleaseEnvironment } from "./release-environment.mjs";

const release = resolveReleaseEnvironment();

process.stdout.write(
  `Release environment validado: ${release.releaseStage}/${release.dataSource}\n`,
);
