function Model(sequelize, DataTypes) {
  return sequelize.define('model', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    label: {
      type: DataTypes.STRING,
      i18n: true,
    },
    reference: {
      type: DataTypes.STRING,
    },
  }, {
    freezeTableName: true,
  });
}

export default function (sequelize) {
  return sequelize.import('model', Model);
}
