/**
 * Sequelize instance hook
 * Define hasMany Association between original models and created i18n models
 */

module.exports = function() {
    
    var self = this;
    this.sequelize.afterDefine('afterDefine_i18n', function( model ) {
        // Loop throught i18n_models
        var i18n_model_name = self.getI18nModel( model.name );
        if( i18n_model_name ) {
            self.sequelize.models[model.name].hasMany(
                self.sequelize.models[i18n_model_name.name], 
                { as : i18n_model_name.name, foreignKey: 'parent_id', unique: 'i18n_unicity_constraint' }
            );
        }
    });
}