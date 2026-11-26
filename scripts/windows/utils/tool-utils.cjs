"use strict";

function readExpectedChecksum(text, filename) {
  const matches = text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([a-f\d]{64})[ \t]+\*?(.+)$/i);
    return match && match[2] === filename ? [match[1].toLowerCase()] : [];
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one SHA-256 entry for ${filename}`);
  }
  return matches[0];
}

function createProjectEnvironment(environment, nodeDirectory, pnpmDirectory) {
  const pathKeys = Object.keys(environment).filter(
    (key) => key.toLowerCase() === "path"
  );
  const originalPath =
    environment.Path ??
    environment.PATH ??
    (pathKeys.length ? environment[pathKeys[0]] : "") ??
    "";
  const result = { ...environment };
  for (const key of pathKeys) delete result[key];
  result.Path = [nodeDirectory, pnpmDirectory, originalPath]
    .filter(Boolean)
    .join(";");
  return result;
}

module.exports = { readExpectedChecksum, createProjectEnvironment };
