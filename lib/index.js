/**
 * sequelize-i18n
 */

var Sequelize       = require('sequelize'),
    utils           = require('./utils'),
    hooks           = require('./hooks'),
    instanceMethods = require('./instance-methods'),
    _               = require('lodash');

/**
 * @param {Object} options List of i18n options
 * @param {Array} object.languages List of allowed languages
 * @param {Object} object.default_language Default language
 * @param {Boolean=true} object.i18n_default_scope Add i18n in the base model default scope
 * @param {Boolean=true} object.add_i18n_scope Add i18n scope in the base model
 * @param {Boolean=true} object.inject_i18n_scope Inject i18n scope in the base model
 * @param {Boolean=true} object.default_language_fallback Fall back to default language if we can't find a value for the given language in get_i18n method 
 */

/**
 * Instantiate sequelize-i18n with a sequelize instance
 * @name Sequelize_i18n
 * @constructor
 * 
 * @param {object} sequelize A sequelize instance
 * @param {object} [options={}] List of i18n options 
 */
var Sequelize_i18n = function( sequelize , options  ) {
    
    options = options || {};
    
    this.sequelize = sequelize;
    
    if( ! (options.languages && Array.isArray(options.languages) && options.languages.length ) ) 
        throw new Error('Languages list is mandatory and can not be empty.')
    this.languages = options.languages;
    
    if( options.default_language && !this.isValidLanguage( options.default_language ) )
        throw new Error('Default language is invalid.')
    this.default_language = options.default_language;
    
    this.default_language_fallback = options.default_language_fallback != null ? options.default_language_fallback : true;
    
    // Add i18n scope in base model
    this.i18n_default_scope = options.i18n_default_scope != null ? options.i18n_default_scope : true;
    this.add_i18n_scope = options.add_i18n_scope != null ? options.add_i18n_scope : true;
    this.inject_i18n_scope = options.inject_i18n_scope != null ? options.inject_i18n_scope : true;
    
    this.language_type = sequelize.Sequelize[utils.getLanguageArrayType( options.languages )]
    this.i18n_models = [];
}


/**
 * Check if a language is valid( ie the given language is in the languages list)
 * @param {String} language The language to be validate
 * return {Boolean}
 */
Sequelize_i18n.prototype.isValidLanguage = function( language ) {
    return this.languages.indexOf( language ) >= 0;
};


/**
 * Get i18n table name from a base table name
 * @param {String} modelName Name of the base model
 * @return {String}
 */
Sequelize_i18n.prototype.getI18nName = utils.getI18nName;

/**
 * Get i18 model from the name of the base model
 * @param {String} model_name Name of the base model
 * @return {SequelizeModel}
 */
Sequelize_i18n.prototype.getI18nModel = function( model_name ) {
    var model = _.filter( this.i18n_models , function( o ) { return o.target.name == model_name });
    if( model && model.length ) return model[0].base;
    return null;
}

/**
 * Create and define a new i18 model
 * @param {String} name i18n model name
 * @param {Object} attributes i18n model schema (See Sequelize define attributes parameter)
 * @param {Object} options i18n model options (See Sequelize define options parameter)
 * @param {String} base_model_name Base model name
 * @return {i18nAssociation}
 */
Sequelize_i18n.prototype.createI18nModel = function( name , attributes , options, base_model_name ) {
    
    if( !attributes ) throw new Error('Could not create i18n model without attributes.');
    
    this.sequelize.define( name , attributes , { indexes : options.indexes , timestamps: false, underscored: true });
    return {
        base : {
            name : name,
            defined : true,
            model : attributes
        },
        target : {
            name : base_model_name,
            defined : false
        }
    };
}
 
/**
 * Add i18n in base model default scope
 * @param {Object} defaultScope Base model default scope
 * @param {String} name Associated i18n model name
 * @return {Scope}
 */
Sequelize_i18n.prototype.setDefaultScope = function( defaultScope , name ) {
    if( ! name ) return defaultScope;
    defaultScope.include = utils.toArray( defaultScope.include );
    defaultScope.include.push( {
        model : this.sequelize.models[name],
        as : name
    });
}


/**
 * Inject i18n in base model user defined scopes
 * @param {Object} scopes Base model scopes
 * @param {String} name Associated i18n model name
 * @return {Scope}
 */
Sequelize_i18n.prototype.injectI18nScope = function( scopes , name ) {
    for( var scope in scopes ) {
        scopes[scope].include = utils.toArray( scopes[scope].include );
        scopes[scope].include.push({
            model : this.sequelize.models[name],
            as : name,
            attributes : {
                exclude : ['id' , 'parent_id']
            },
        });
    }
};


/**
 * Add i18n in base model scopes
 * @param {Object} scopes Base model scopes
 * @param {String} name Associated i18n model name
 * @return {Scope}
 */
Sequelize_i18n.prototype.addI18nScope = function( scopes , name ) {
    scopes.i18n = function( lang ) {
        return  {
            include : {
                model : sequelize.models[name],
                as : name,
                attributes : {
                    exclude : ['id', 'parent_id']
                }
            }
        }
    };
}

// Define model instance methods ( getter and setter )
Sequelize_i18n.prototype.setInstanceMethods = function( instance_methods , _i18n_modelName ) {
    instance_methods.set_i18n = this.set_i18n( _i18n_modelName );
    instance_methods.get_i18n = this.get_i18n( _i18n_modelName );
};


// Define hooks
Sequelize_i18n.prototype.beforeDefine = hooks.beforeDefine;
Sequelize_i18n.prototype.afterDefine = hooks.afterDefine;
Sequelize_i18n.prototype.beforeFind = hooks.beforeFind; 
Sequelize_i18n.prototype.afterCreate = hooks.afterCreate;
Sequelize_i18n.prototype.afterUpdate = hooks.afterUpdate;
Sequelize_i18n.prototype.afterDelete = hooks.afterDelete;

// Define instance methods
Sequelize_i18n.prototype.set_i18n = instanceMethods.set_i18n;
Sequelize_i18n.prototype.get_i18n = instanceMethods.get_i18n;


Sequelize_i18n.prototype.init = function() {
    this.beforeDefine();
    this.afterDefine();
}

module.exports = Sequelize_i18n;