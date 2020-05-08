module.exports = {
  root: true,
  extends: [
    "airbnb",
    "plugin:prettier/recommended"
  ],
  parser: "babel-eslint",
  env: {
    node: true,
    es6: true,
    jest: true,
    mocha: true
  },
  plugins: [
    "babel",
    "prettier",
    "chai-friendly",
    "import"
  ],
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js"]
      }
    }
  }
};
