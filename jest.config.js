module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["expo-sqlite-mock/src/setup.ts"],
  testTimeout: 10000,
};
