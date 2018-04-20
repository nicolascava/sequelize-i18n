import _ from 'lodash';

export default class SequelizeI18N {
  // Get i18n table name from a base table name
  static getI18NName(modelName) {
    return `${modelName}_i18n`;
  }

  static getLanguageArrayType(arr) {
    let isNumber = true;

    for (let index = 0; index < arr.length; index += 1) {
      if (typeof arr[index] !== 'number') isNumber = false;
    }

    return isNumber ? 'INTEGER' : 'STRING';
  }

  static getModelUniqueKey(model) {
    let pk = _.filter(model, obj => obj.primaryKey === true);

    if (!(pk && pk.length)) pk = _.filter(model, obj => obj.unique === true);

    pk = pk[0] || null;

    return pk;
  }

  static toArray(obj) {
    if (obj) {
      if (Array.isArray(obj)) return obj;

      return [obj];
    }

    return [];
  }

  constructor(sequelize, options) {
    const baseOptions = options || {};

    this.sequelize = sequelize;

    if (!(
      baseOptions.languages &&
      Array.isArray(baseOptions.languages) &&
      baseOptions.languages.length
    )) {
      throw new Error('Language list is mandatory and can\'t be empty');
    }

    this.languages = baseOptions.languages;

    if (baseOptions.defaultLanguage && !this.isValidLanguage(baseOptions.defaultLanguage)) {
      throw new Error('Default language is invalid');
    }

    this.defaultLanguage = baseOptions.defaultLanguage;
    this.defaultLanguageFallback = baseOptions.defaultLanguageFallback !== null ?
      baseOptions.defaultLanguageFallback : true;

    this.i18nDefaultScope = baseOptions.i18nDefaultScope !== null ?
      baseOptions.i18nDefaultScope : true;
    this.addI18NScope = baseOptions.addI18NScope !== null ?
      baseOptions.addI18NScope : true;
    this.injectI18NScope = baseOptions.injectI18NScope !== null ?
      baseOptions.injectI18NScope : true;

    const key = SequelizeI18N.getLanguageArrayType(baseOptions.languages);

    this.languageType = sequelize.Sequelize[key];
    this.i18nModels = [];
  }

  init() {
    this.beforeDefine();
    this.afterDefine();
  }

  // Check if a language is valid (e.q. the given language is in the languages list)
  isValidLanguage(language) {
    return this.languages.indexOf(language) >= 0;
  }

  // Get i18n model from the base model name
  getI18NModel(modelName) {
    const model = _.filter(this.i18nModels, obj => obj.target.name === modelName);

    if (model && model.length) return model[0].base;

    return null;
  }

  // Create and define a new i18n model
  createI18NModel(name, attributes, options, baseModelName) {
    if (!attributes) throw new Error('Could not create i18n model without attributes');

    this.sequelize.define(name, attributes, {
      indexes: options.indexes,
      timestamps: false,
      underscored: true,
    });

    return {
      base: {
        name,
        defined: true,
        model: attributes,
      },
      target: {
        name: baseModelName,
        defined: false,
      },
    };
  }

  // Add i18n in base model default scope
  setDefaultScope(defaultScope, name) {
    if (!name) return defaultScope;

    const mutableDefaultScope = defaultScope;

    mutableDefaultScope.include = SequelizeI18N.toArray(mutableDefaultScope.include);
    mutableDefaultScope.include.push({
      model: this.sequelize.models[name],
      as: name,
    });

    return null;
  }

  // Inject i18n in base model user defined scopes
  injectI18NScope(scopes, name) {
    const mutableScopes = scopes;

    Object.keys(mutableScopes).forEach((scope) => {
      mutableScopes[scope].include = SequelizeI18N.toArray(mutableScopes[scope].include);
      mutableScopes[scope].include.push({
        model: this.sequelize.models[name],
        as: name,
        attributes: {
          exclude: ['id', 'parent_id'],
        },
      });
    });
  }

  // Add i18n in base model scopes
  addI18NScope(scopes, name) {
    const mutableScopes = scopes;

    mutableScopes.i18n = () => ({
      include: {
        model: this.sequelize.models[name],
        as: name,
        attributes: {
          exclude: ['id', 'parent_id'],
        },
      },
    });
  }

  // Define model instance methods
  setInstanceMethods(baseInstanceMethods, i18nModelName) {
    const mutableBaseInstanceMethods = baseInstanceMethods;

    mutableBaseInstanceMethods.setI18N = this.setI18N(i18nModelName);
    mutableBaseInstanceMethods.getI18N = this.getI18N(i18nModelName);
  }

  afterCreate() {
    return (instance, options, fn) => {
      const i18nModel = this.getI18NModel(this.name);

      if (i18nModel === null) return fn();

      const i18nOptions = {};

      if (instance && instance.dataValues && i18nModel.model) {
        Object.keys(instance.dataValues).forEach((prop) => {
          if (prop in i18nModel.model) i18nOptions[prop] = instance.dataValues[prop];
        });

        i18nOptions.languageID = this.defaultLanguage;

        if (options.languageID) i18nOptions.languageID = options.languageID;

        i18nOptions.parentID = instance.dataValues.id;
      }

      return this
        .sequelize
        .models[i18nModel.name]
        .findOrCreate({
          where: {
            language_id: i18nOptions.languageID,
            parent_id: i18nOptions.parentID,
          },

          // TODO: probably a bad key mapping here.
          defaults: i18nOptions,
        })
        .then(() =>
          instance
            .reload()
            .then(() => fn()))
        .catch(error =>
          instance
            .destroy({ force: true })
            .then(() => fn(error)));
    };
  }

  afterDefine() {
    this.sequelize.afterDefine('afterDefine_i18n', (model) => {
      const i18nModelName = this.getI18NModel(model.name);

      if (i18nModelName) {
        this.sequelize.models[model.name].hasMany(
          this.sequelize.models[i18nModelName.name],
          {
            as: i18nModelName.name,
            foreignKey: 'parent_id',
            unique: 'i18n_unicity_constraint',
          },
        );
      }
    });
  }

  afterDelete() {
    return (instance, options, fn) => {
      const i18nModel = this.getI18NModel(this.name);

      if (i18nModel === null) return fn();

      return this
        .sequelize
        .models[i18nModel.name]
        .destroy({
          where: {
            parent_id: instance.id,
          },
        })
        .then(() => fn())
        .catch(error => fn(error));
    };
  }

  afterUpdate() {
    return (instance, options, fn) => {
      const i18nModel = this.getI18NModel(this.name);

      if (i18nModel === null) return fn();

      const i18nOptions = {};

      if (instance && instance.dataValues && i18nModel.model) {
        Object.keys(instance.dataValues).forEach((prop) => {
          if (prop in i18nModel.model) i18nOptions[prop] = instance.dataValues[prop];
        });

        i18nOptions.languageID = this.defaultLanguage;

        if (options.languageID) i18nOptions.languageID = options.languageID;

        i18nOptions.parentID = instance.dataValues.id;
      }

      return this
        .sequelize
        .models[i18nModel.name]
        .upsert(i18nOptions)
        .then(() =>
          instance
            .reload()
            .then(() => fn()));
    };
  }

  beforeDefine() {
    this.sequelize.beforeDefine('beforeDefine_i18n', (model, options) => {
      const mutableModel = model;
      const mutableOptions = options;
      const baseOptions = {
        indexes: [],
      };
      const pk = SequelizeI18N.getModelUniqueKey(mutableModel);

      let schema = null;

      Object.keys(mutableModel).forEach((prop) => {
        if ('i18n' in mutableModel[prop] && (mutableModel[prop].i18n === true)) {
          if (!pk) {
            throw new Error(`No primary or unique key found for ${mutableOptions.modelName} model`);
          }

          schema = schema || {
            language_id: {
              type: this.languageType,
              unique: 'i18n_unicity_constraint',
            },
            parent_id: {
              type: pk.type,
              unique: 'i18n_unicity_constraint',
            },
          };

          if ('unique' in mutableModel[prop] && (mutableModel[prop].unique === true)) {
            baseOptions.indexes.push({
              unique: true,
              fields: ['language_id', prop],
            });
          }

          schema[prop] = {
            type: mutableModel[prop].type,
          };
          mutableModel[prop].type = this.sequelize.Sequelize.VIRTUAL;
        }
      });

      if (schema) {
        const name = SequelizeI18N.getI18NName(mutableOptions.modelName);
        const createdModel = this.createI18NModel(
          SequelizeI18N.getI18NName(mutableOptions.modelName),
          schema,
          baseOptions,
          mutableOptions.modelName,
        );

        this.i18nModels.push(createdModel);

        if (this.i18nDefaultScope) {
          mutableOptions.defaultScope = mutableOptions.defaultScope || {};
          this.setDefaultScope(mutableOptions.defaultScope, name);
        }

        if (this.addI18NScope) {
          mutableOptions.scopes = mutableOptions.scopes || {};
          this.addI18NScope(mutableOptions.scopes, name);
        }

        if (this.injectI18NScope) {
          mutableOptions.scopes = mutableOptions.scopes || {};
          this.injectI18NScope(mutableOptions.scopes, name);
        }

        mutableOptions.instanceMethods = mutableOptions.instanceMethods || {};
        this.setInstanceMethods(mutableOptions.instanceMethods, name);

        mutableOptions.hooks = mutableOptions.hooks || {};
        mutableOptions.hooks.beforeFind = this.beforeFind();
        mutableOptions.hooks.afterCreate = this.afterCreate();
        mutableOptions.hooks.afterUpdate = this.afterUpdate();
        mutableOptions.hooks.afterDelete = this.afterDelete();
      }
    });
  }

  beforeFind() {
    return (options) => {
      const mutableOptions = options;
      const i18nModel = this.getI18NModel(this.name);

      if (mutableOptions && mutableOptions.where && i18nModel) {
        Object.keys(mutableOptions.where).forEach((prop) => {
          if (prop in i18nModel.model) {
            mutableOptions.include = mutableOptions.include || [];

            mutableOptions.include.forEach((incl) => {
              const mutableIncl = incl;

              if (mutableIncl.model.name === i18nModel.name) {
                mutableIncl.where = mutableIncl.where || {};
                mutableIncl.where[prop] = mutableOptions.where[prop];
              }
            });

            delete mutableOptions.where[prop];
          }

          if (Array.isArray(mutableOptions.where[prop])) {
            mutableOptions.include = mutableOptions.include || [];

            mutableOptions.include.forEach((incl) => {
              const mutableIncl = incl;

              if (mutableIncl.model.name === i18nModel.name) {
                mutableIncl.where = mutableIncl.where || {};
                mutableIncl.where[prop] = mutableOptions.where[prop];
              }
            });

            delete mutableOptions.where[prop];
          }
        });
      }

      if (mutableOptions && mutableOptions.order && i18nModel) {
        mutableOptions.order.forEach((prop, index) => {
          if (prop[0] in i18nModel.model) {
            mutableOptions.order[index] = [{
              model: this.sequelize.models[i18nModel.name],
              as: i18nModel.name,
            }, prop[0], prop[1]];
          }
        });
      }
    };
  }

  getI18N(modelName) {
    return (lang, options) => {
      const mutableOptions = options || {};

      let exit = false;

      mutableOptions.defaultLanguageFallback = mutableOptions.defaultLanguageFallback !== null ?
        mutableOptions.defaultLanguageFallback : this.defaultLanguageFallback;

      if (this.defaultLanguage === null || !mutableOptions.defaultLanguageFallback) exit = true;

      // TODO: model name is not defined as this in the instance which can break the whole library.
      if (!(this[modelName] && this[modelName].length) || exit) return this;

      for (let index = 0; index < this[modelName].length; index += 1) {
        const value = this[modelName][index].toJSON();

        if (value.languageID && value.languageID === lang) {
          exit = true;

          Object.keys(value).forEach((prop) => {
            if (prop !== 'languageID' && prop !== 'parentID' && prop !== 'id') {
              this[prop] = value[prop];
            }
          });
        }
      }

      return this;
    };
  }

  setI18N(modelName) {
    return (lang, propertyName, value, callback) => {
      if (!lang && !this.defaultLanguage) throw new Error('No language given');
      if (!propertyName) throw new Error('Property name to update is missing');

      const currentObjectID = this.id;
      const options = {
        parentID: currentObjectID,
        languageID: lang,
      };

      options[propertyName] = value;

      this.sequelize.models[modelName].upsert(options).then((result) => {
        if (callback && (typeof callback === 'function')) callback(result);
      });
    };
  }
}
