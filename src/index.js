import { filter, assign, includes, find } from "lodash";

import logger from "./logger";

class SequelizeI18N {
  get options() {
    return this.baseOptions;
  }

  // Get i18n table name from a base table name.
  getI18NName(modelName) {
    return `${modelName}${this.baseOptions.suffix}`;
  }

  getLanguageArrayType() {
    let isNumber = true;
    const arr = this.baseOptions.languages;

    for (let index = 0; index < arr.length; index += 1) {
      if (typeof arr[index] !== "number") {
        isNumber = false;
        break;
      }
    }

    return isNumber ? "INTEGER" : "STRING";
  }

  static getModelUniqueKey(model) {
    let pk = filter(model, (obj) => obj.primaryKey === true);

    if (!(pk && pk.length)) pk = filter(model, (obj) => obj.unique === true);

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

  static createI18nOptions(i18nModel, instance) {
    return (acc, value) => {
      if (value in i18nModel.model) {
        return { ...acc, [value]: instance.dataValues[value] };
      }

      return acc;
    };
  }

  constructor(sequelize, options) {
    const defaultOptions = {
      i18nDefaultScope: true,
      addI18NScope: true,
      injectI18NScope: true,
      suffix: "_i18n",
    };

    this.baseOptions = assign({}, defaultOptions, options);
    this.excludedAttributes = ["id", "parent_id"];

    if (
      !(
        this.baseOptions.languages &&
        Array.isArray(this.baseOptions.languages) &&
        this.baseOptions.languages.length &&
        this.baseOptions.defaultLanguage
      )
    ) {
      throw new Error(
        "Language list and default language are mandatory and can't be empty"
      );
    }

    if (
      this.baseOptions.defaultLanguage &&
      this.baseOptions.languages.indexOf(this.baseOptions.defaultLanguage) ===
        -1
    ) {
      throw new Error("Default language is invalid");
    }

    const key = this.getLanguageArrayType();

    this.sequelize = Object.assign(sequelize, {
      options: {
        ...sequelize.options,
        i18nOptions: this.baseOptions,
      },
    });
    this.languageType = sequelize.Sequelize[key];
    this.i18nModels = {};
  }

  init() {
    this.beforeDefine();
    this.afterDefine();
  }

  // Create and define a new i18n model.
  createI18NModel(name, attributes, options, baseModelName) {
    if (!attributes)
      throw new Error("Could not create i18n model without attributes");

    this.sequelize.define(name, attributes, options);

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

  getFormattedInclude(modelName) {
    const model = this.sequelize.models[modelName];

    return {
      model,
      as: model.name,
      attributes: {
        exclude: this.excludedAttributes,
      },
    };
  }

  // Add i18n in base model default scope.
  setDefaultScope(defaultScope, name) {
    if (!name) return defaultScope;

    const mutableDefaultScope = defaultScope;
    const defInclude = this.getFormattedInclude(name);

    mutableDefaultScope.include = SequelizeI18N.toArray(
      mutableDefaultScope.include
    );
    mutableDefaultScope.include.push(defInclude);

    return null;
  }

  // Inject i18n in base model user defined scopes.
  injectI18NScope(scopes, name) {
    const mutableScopes = scopes;

    Object.keys(mutableScopes).forEach((scope) => {
      mutableScopes[scope].include = SequelizeI18N.toArray(
        mutableScopes[scope].include
      );
      mutableScopes[scope].include.push(this.getFormattedInclude(name));
    });
  }

  // Add i18n in base model scopes.
  addI18NScope(scopes, name) {
    const mutableScopes = scopes;
    const include = this.getFormattedInclude(name);

    // Filter on language.
    mutableScopes.i18n = function i18n(languageID) {
      logger.log("i18N scope has been invoked with language ", languageID);

      if (languageID)
        return {
          include,
          where: { language_id: languageID },
        };

      return { include };
    };
  }

  // Define model instance methods.
  setInstanceMethods(baseInstanceMethods, i18nModelName) {
    const mutableBaseInstanceMethods = baseInstanceMethods;

    mutableBaseInstanceMethods.setI18N = this.setI18N(i18nModelName);
    mutableBaseInstanceMethods.getI18N = this.getI18N(i18nModelName);
  }

  afterCreate(instance, options) {
    const { i18nModel } = this;

    if (i18nModel === null) return null;

    const baseOptions = this.sequelize.options.i18nOptions || {};

    if (instance && instance.dataValues && i18nModel.model) {
      const i18nOptions = Object.keys(instance.dataValues).reduce(
        SequelizeI18N.createI18nOptions(i18nModel, instance),
        {}
      );

      i18nOptions.language_id =
        options.language_id || baseOptions.defaultLanguage;
      i18nOptions.parent_id = instance.dataValues.id;

      return this.sequelize.models[i18nModel.name]
        .findOrCreate({
          where: {
            language_id: i18nOptions.language_id,
            parent_id: i18nOptions.parent_id,
          },

          // TODO: probably a bad key mapping here.
          defaults: i18nOptions,
        })
        .then(() => instance.reload())
        .catch((error) =>
          instance.destroy({ force: true }).then(() => {
            throw error;
          })
        );
    }

    return null;
  }

  addI18N(newValues, languageID) {
    const instance = this;
    const addI18NModel = this.sequelize.models[this.constructor.name];
    const baseOptions = this.sequelize.options.i18nOptions || {};

    if (
      !newValues ||
      !addI18NModel.i18nModel ||
      !languageID ||
      !baseOptions ||
      !includes(baseOptions.languages, languageID)
    ) {
      return null;
    }

    const i18nOptions = {
      language_id: languageID,
      parent_id: instance.id,
    };

    const whereClause = assign(i18nOptions);

    if (addI18NModel.i18nModel.model) {
      Object.keys(newValues).forEach((prop) => {
        if (prop in addI18NModel.i18nModel.model)
          i18nOptions[prop] = newValues[prop];
      });
    }

    return this.sequelize.models[addI18NModel.i18nModel.name]
      .findOrCreate({
        where: whereClause,
        defaults: i18nOptions,
      })
      .then(() =>
        instance.reload({
          language_id: languageID,
        })
      );
  }

  static deleteI18N(i18nModel) {
    return function deleteI18N(languageID) {
      const instance = this;

      if (!languageID) return null;

      return this.sequelize.models[i18nModel.name].destroy({
        where: {
          language_id: languageID,
          parent_id: instance.id,
        },
      });
    };
  }

  getI18NByLanguageID(languageID) {
    const model = this.sequelize.models[this.constructor.name];
    const { i18nModel } = model;

    if (!i18nModel) return null;

    return find(this[i18nModel.name], ["language_id", languageID]);
  }

  afterDefine() {
    this.sequelize.afterDefine("afterDefine_i18n", (model) => {
      if (this.i18nModels[model.name]) {
        const i18nModel = this.i18nModels[model.name].base;
        const i18nRealModel = this.sequelize.models[i18nModel.name];

        if (i18nModel) {
          const enhancedModel = Object.assign(model, {
            i18nModel,
            i18n: i18nRealModel,
          });

          this.sequelize.models[model.name].hasMany(i18nRealModel, {
            as: i18nRealModel.name,
            foreignKey: "parent_id",
            unique: "i18n_unicity_constraint",
          });

          enhancedModel.addHook(
            "beforeFind",
            "addLanguage_i18n",
            this.addLanguage
          );
          enhancedModel.addHook(
            "beforeFind",
            "beforeFind_i18n",
            this.beforeFind
          );
          enhancedModel.addHook(
            "afterCreate",
            "afterCreate_i18n",
            this.afterCreate
          );
          enhancedModel.addHook(
            "afterUpdate",
            "afterUpdate_i18n",
            this.afterUpdate
          );
          enhancedModel.addHook(
            "afterDestroy",
            "afterDelete_i18n",
            this.afterDelete
          );

          // Add ability to add a translation for another language.
          enhancedModel.prototype.addI18N = this.addI18N;

          // Add ability to remove a translation for another language.
          enhancedModel.prototype.deleteI18N = SequelizeI18N.deleteI18N(
            i18nModel
          );

          // Add ability to remove a translation for another language.
          enhancedModel.prototype.getI18N = this.getI18NByLanguageID;
        }
      }
    });
  }

  afterDelete(instance) {
    const { i18nModel } = this;

    if (i18nModel === null) return null;

    return this.sequelize.models[i18nModel.name].destroy({
      where: {
        parent_id: instance.id,
      },
    });
  }

  afterUpdate(instance, options) {
    const { i18nModel } = this;

    if (i18nModel === null) return null;

    const baseOptions = this.sequelize.options.i18nOptions || {};

    if (instance && instance.dataValues && i18nModel.model) {
      const i18nOptions = Object.keys(instance.dataValues).reduce(
        SequelizeI18N.createI18nOptions(i18nModel, instance),
        {}
      );

      i18nOptions.language_id =
        options.language_id || baseOptions.defaultLanguage;
      i18nOptions.parent_id = instance.dataValues.id;

      return this.sequelize.models[i18nModel.name]
        .update(i18nOptions, {
          where: {
            parent_id: i18nOptions.parent_id,
            language_id: i18nOptions.language_id,
          },
        })
        .then(() => instance.reload());
    }

    return null;
  }

  beforeDefine() {
    this.sequelize.beforeDefine("beforeDefine_i18n", (model, options) => {
      const mutableModel = model;
      const mutableOptions = options;
      const baseOptions = {
        indexes: [],
        paranoid: mutableOptions.paranoid,
        timestamps: mutableOptions.timestamps,
        underscored: mutableOptions.i18n
          ? mutableOptions.i18n.underscored && true
          : true,
      };
      const pk = SequelizeI18N.getModelUniqueKey(mutableModel);

      let schema = null;

      Object.keys(mutableModel).forEach((prop) => {
        if ("i18n" in mutableModel[prop] && mutableModel[prop].i18n === true) {
          if (!pk) {
            throw new Error(
              `No primary or unique key found for ${mutableOptions.modelName} model`
            );
          }

          schema = schema || {
            language_id: {
              type: this.languageType,
              unique: "i18n_unicity_constraint",
            },
            parent_id: {
              type: pk.type,
              unique: "i18n_unicity_constraint",
            },
          };

          const deletedAtName = mutableOptions.deletedAt;

          // If paranoid mode, the deleted element stays in the DB so we need to
          // add the field `deletedAt` to the unique key (field created by using paranoid).
          if (mutableOptions.paranoid)
            schema[deletedAtName] = {
              type: this.sequelize.Sequelize.DATE,
              unique: "i18n_unicity_constraint",
            };

          if (
            "unique" in mutableModel[prop] &&
            mutableModel[prop].unique === true
          ) {
            baseOptions.indexes.push({
              unique: true,
              fields: mutableOptions.paranoid
                ? ["language_id", deletedAtName, prop]
                : ["language_id", prop],
            });
          }

          schema[prop] = {
            type: mutableModel[prop].type,
          };

          mutableModel[prop].type = this.sequelize.Sequelize.VIRTUAL;

          // Add a `VIRTUAL` field for `language_id` to be added to the `FIND` queries.
          if (
            !mutableModel.language_id ||
            mutableModel.language_id.type !== this.sequelize.Sequelize.VIRTUAL
          ) {
            mutableModel.language_id = {
              type: this.sequelize.Sequelize.VIRTUAL,
            };
          }
        }
      });

      if (schema) {
        const name = this.getI18NName(mutableOptions.modelName);

        this.i18nModels[mutableOptions.modelName] = this.createI18NModel(
          name,
          schema,
          baseOptions,
          mutableOptions.modelName
        );

        if (this.baseOptions.i18nDefaultScope) {
          mutableOptions.defaultScope = mutableOptions.defaultScope || {};
          this.setDefaultScope(mutableOptions.defaultScope, name);
        }

        if (this.baseOptions.addI18NScope) {
          mutableOptions.scopes = mutableOptions.scopes || {};
          this.addI18NScope(mutableOptions.scopes, name);
        }

        if (this.baseOptions.injectI18NScope) {
          mutableOptions.scopes = mutableOptions.scopes || {};
          this.injectI18NScope(mutableOptions.scopes, name);
        }

        mutableOptions.instanceMethods = mutableOptions.instanceMethods || {};
        this.setInstanceMethods(mutableOptions.instanceMethods, name);
      }
    });
  }

  addLanguage(options) {
    const mutableOptions = options;

    // Add the language value to the virtual field if provided so it can be used by each returned instance.
    if (
      this.rawAttributes.language_id &&
      this.rawAttributes.language_id.type.constructor.name === "VIRTUAL" &&
      (mutableOptions.language_id ||
        (mutableOptions.where && mutableOptions.where.language_id))
    ) {
      if (!mutableOptions.attributes) {
        mutableOptions.attributes = [...Object.keys(this.tableAttributes)];
      }

      const locale =
        mutableOptions.language_id || mutableOptions.where.language_id;

      mutableOptions.attributes.push([
        this.sequelize.literal(`'${locale}'`),
        "language_id",
      ]);
    }
  }

  static updateWhereClause(i18nModel, mutableOptions, prop) {
    return (incl) => {
      if (incl.model.name === i18nModel.name) {
        return Object.assign(incl, {
          where: {
            ...incl.where,
            [prop]: mutableOptions.where[prop],
          },
        });
      }

      return incl;
    };
  }

  beforeFind(options) {
    const mutableOptions = options;
    const { i18nModel } = this;

    if (mutableOptions && mutableOptions.where && i18nModel) {
      Object.keys(mutableOptions.where).forEach((prop) => {
        mutableOptions.include = mutableOptions.include || [];

        if (
          prop in i18nModel.model ||
          Array.isArray(mutableOptions.where[prop])
        ) {
          mutableOptions.include.forEach(
            SequelizeI18N.updateWhereClause(i18nModel, mutableOptions, prop)
          );

          delete mutableOptions.where[prop];
        }
      });
    }

    if (mutableOptions && mutableOptions.order && i18nModel) {
      mutableOptions.order.forEach((prop, index) => {
        if (prop[0] in i18nModel.model) {
          mutableOptions.order[index] = [
            {
              model: this.sequelize.models[i18nModel.name],
              as: i18nModel.name,
            },
            prop[0],
            prop[1],
          ];
        }
      });
    }
  }

  getI18N(modelName) {
    return (lang) => {
      let exit = false;

      if (this.baseOptions.defaultLanguage === null) exit = true;

      // TODO: model name is not defined as this in the instance which can break the whole library.
      if (!(this[modelName] && this[modelName].length) || exit) return this;

      for (let index = 0; index < this[modelName].length; index += 1) {
        const value = this[modelName][index].toJSON();

        if (value.language_id && value.language_id === lang) {
          exit = true;

          Object.keys(value).forEach((prop) => {
            if (
              prop !== "language_id" &&
              prop !== "parent_id" &&
              prop !== "id"
            ) {
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
      if (!lang && !this.baseOptions.defaultLanguage) {
        throw new Error("No language given");
      }

      if (!propertyName) throw new Error("Property name to update is missing");

      const currentObjectID = this.id;
      const options = {
        parent_id: currentObjectID,
        language_id: lang,
      };

      options[propertyName] = value;

      this.sequelize.models[modelName].upsert(options).then((result) => {
        if (callback && typeof callback === "function") callback(result);
      });
    };
  }
}

module.exports = SequelizeI18N;
