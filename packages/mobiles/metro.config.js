// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// 모노레포 구조를 위한 경로 설정
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// 기본 설정 가져오기
const config = getDefaultConfig(projectRoot);

// 모노레포 설정 추가
config.watchFolders = [workspaceRoot];

// 루트 node_modules도 모듈 검색 경로에 추가
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
