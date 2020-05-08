const tb1 = function (sequelize, DataTypes) {
  return sequelize.define(
    "table1",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      label: {
        type: DataTypes.STRING,
        i18n: true,
      },
      description: {
        type: DataTypes.STRING,
        i18n: true,
      },
      reference: {
        type: DataTypes.STRING,
      },
    },
    {
      freezeTableName: true,
    }
  );
};

const tb2 = function (sequelize, DataTypes) {
  return sequelize.define(
    "table2",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      label: {
        type: DataTypes.STRING,
      },
      reference: {
        type: DataTypes.STRING,
      },
    },
    {
      freezeTableName: true,
      i18n: {
        underscored: false,
      },
    }
  );
};

module.exports = function (sequelize) {
  const table1 = sequelize.import("table1", tb1);
  const table2 = sequelize.import("table2", tb2);

  return { table1, table2 };
};
