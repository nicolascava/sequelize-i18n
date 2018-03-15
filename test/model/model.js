var Model = function (sequelize, DataTypes) {
    var Model = sequelize.define('model', {
        id : {
            type 			: DataTypes.BIGINT,
            primaryKey 		: true,
            autoIncrement 	: true
        },
        label : {
            type 			: DataTypes.STRING,
            i18n		 	: true,
        },
        reference : {
            type 			: DataTypes.STRING,
        }
    },
    
    { freezeTableName : true });
    return Model;
};


module.exports = function(sequelize) {
    return sequelize.import('model', Model)
};