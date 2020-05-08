module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "14"
        },
        useBuiltIns: "entry",
        corejs: 3
      }
    ]
  ]
};
