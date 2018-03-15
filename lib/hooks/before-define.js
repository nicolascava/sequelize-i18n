/**
 * Sequelize instance hook
 * Inspect each manually define models and create the corresponding i18n model
 */
var _ = require('lodash');
var utils = require('../utils');

module.exports = function() {
    
    var self = this;
    
    this.sequelize.beforeDefine('beforeDefine_i18n', function( model , options ) {
        var schema = null;
        var _options = {
            indexes : []
        };
        
        // Check if current model has i18n property        
        var pk = utils.getModelUniqueKey( model );

        for( var prop in model ) {
            if( model.hasOwnProperty( prop ) ){
                
                if( 'i18n' in model[prop] && (model[prop].i18n === true) ) {
                    if( !pk ) throw new Error('No primary or unique key found for ' + options.modelName + ' model' );
                    schema = schema || {
                        'language_id' : {
                            type 			: self.language_type,
                            unique:         'i18n_unicity_constraint'
                        },
                        'parent_id' : {
                            type 			: pk.type,
                            unique:         'i18n_unicity_constraint'
                        }
                    };
                    if ('unique' in model[prop] && (model[prop].unique === true)) {
                        _options.indexes.push({
                            unique: true,
                            fields: ['language_id' , prop]
                        });
                    }
                    schema[prop] = {
                        type : model[prop].type
                    }
                    model[prop].type = self.sequelize.Sequelize.VIRTUAL;
                }
            }
        }
        
        if( schema ) {

            var name = self.getI18nName( options.modelName );
            var created_model = self.createI18nModel( self.getI18nName( options.modelName ) , schema , _options , options.modelName );
            
            // Save created model 
            self.i18n_models.push( created_model);
            
            if( self.i18n_default_scope ) {
                options.defaultScope = options.defaultScope || {};
                self.setDefaultScope( options.defaultScope , name );
            }
            if( self.add_i18n_scope ) {
                options.scopes = options.scopes || {};
                self.addI18nScope( options.scopes , name );
            }
            if( self.inject_i18n_scope ) {
                options.scopes = options.scopes || {};
                self.injectI18nScope( options.scopes , name );
            }
            
            options.instanceMethods = options.instanceMethods || {};
            self.setInstanceMethods( options.instanceMethods , name ) ;

            // Add hooks to model
            options.hooks = options.hooks || {};
            options.hooks.beforeFind = self.beforeFind();
            options.hooks.afterCreate = self.afterCreate();
            options.hooks.afterUpdate = self.afterUpdate();
            options.hooks.afterDelete = self.afterDelete();
        }
    });
}