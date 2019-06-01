var _ = require('lodash');

class SequelizeI18N {

	get options() {
		return this.baseOptions;
	}
	
	// Get i18n table name from a base table name
	getI18NName(modelName) {	
		return `${modelName}${this.baseOptions.suffix}`;
	}

	getLanguageArrayType() {
		let isNumber = true;
		const arr = this.baseOptions.languages;

		for (let index = 0; index < arr.length; index += 1) {
			if (typeof arr[index] !== 'number') {
				isNumber = false;
				break;
			}
		}

		return isNumber ? 'INTEGER' : 'STRING';
	}

	getModelUniqueKey(model) {
		let pk = _.filter(model, obj => obj.primaryKey === true);

		if (!(pk && pk.length)) pk = _.filter(model, obj => obj.unique === true);

		pk = pk[0] || null;

		return pk;
	}

	toArray(obj) {
		if (obj) {
			if (Array.isArray(obj)) return obj;

			return [obj];
		}

		return [];
	}

	constructor(sequelize, options) {	
		
		var defaultOptions = {	
			i18nDefaultScope : true,
			addI18NScope : true,
			injectI18NScope : true,
			suffix: '_i18n',		
		};

		this.baseOptions =  _.assign({}, defaultOptions, options);	  
		this.excludedAttributes = ["id", "parent_id"];  
		
		if (!(
				this.baseOptions.languages &&
				Array.isArray(this.baseOptions.languages) &&
				this.baseOptions.languages.length &&
				this.baseOptions.defaultLanguage
			)) {
				throw new Error('Language list and default language are mandatory and can\'t be empty');
		}

		if (this.baseOptions.defaultLanguage && this.baseOptions.languages.indexOf(this.baseOptions.defaultLanguage) == -1) {
			throw new Error('Default language is invalid');
		}
		
		const key = this.getLanguageArrayType();
		sequelize.options.i18nOptions = this.baseOptions;
		this.sequelize = sequelize;
		this.languageType = sequelize.Sequelize[key];
		this.i18nModels = {};
	}

	init() {    
		this.beforeDefine();
		this.afterDefine();
	}

	// Create and define a new i18n model
	createI18NModel(name, attributes, options, baseModelName) {
		if (!attributes) throw new Error('Could not create i18n model without attributes');

		this.sequelize.define(name, attributes, {
			indexes: options.indexes,
			timestamps: false,
			underscored: options.underscored || true,
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

	getFormattedInclude(modelName){
		const model =  this.sequelize.models[modelName];

		return {
			model: model,
			//limit: 1,
			as: model.name,			
			attributes: {
				exclude: this.excludedAttributes,
			},
		}
	}

	// Add i18n in base model default scope
	setDefaultScope(defaultScope, name) {
		if (!name) return defaultScope;

		const mutableDefaultScope = defaultScope;		
		const defInclude= this.getFormattedInclude(name);

		mutableDefaultScope.include = this.toArray(mutableDefaultScope.include);		
		mutableDefaultScope.include.push(defInclude);		

		return null;
	}

	// Inject i18n in base model user defined scopes
	injectI18NScope(scopes, name) {
		const mutableScopes = scopes;	

		Object.keys(mutableScopes).forEach((scope) => {
			mutableScopes[scope].include = this.toArray(mutableScopes[scope].include);
			mutableScopes[scope].include.push(this.getFormattedInclude(name));
		});
	}

	// Add i18n in base model scopes
	addI18NScope(scopes, name) {
		const mutableScopes = scopes;	
		const include = this.getFormattedInclude(name);		

		//filter on language
		mutableScopes.i18n = function (language_id) {
			console.log('i18N scope has been invoked with language ', language_id);
			
			if(language_id)
				return {
					include,
					where:{	language_id	}
				}
			
			return {
				include
			}
		};		
	}

	// Define model instance methods
	setInstanceMethods(baseInstanceMethods, i18nModelName) {
		const mutableBaseInstanceMethods = baseInstanceMethods;

		mutableBaseInstanceMethods.setI18N = this.setI18N(i18nModelName);
		mutableBaseInstanceMethods.getI18N = this.getI18N(i18nModelName);	
	}

	afterCreate(instance, options) {		
		const i18nModel = this.i18nModel;

		if (i18nModel === null) return;

		const i18nOptions = {};
		const baseOptions = this.sequelize.options.i18nOptions || {};

		if (instance && instance.dataValues && i18nModel.model) {
			Object.keys(instance.dataValues).forEach((prop) => {
				if (prop in i18nModel.model) i18nOptions[prop] = instance.dataValues[prop];
			});

			i18nOptions.language_id = options.language_id || baseOptions.defaultLanguage;
			i18nOptions.parent_id = instance.dataValues.id;
		}			

		return this
			.sequelize
			.models[i18nModel.name]
			.findOrCreate({
				where: {
					language_id: i18nOptions.language_id,
					parent_id: i18nOptions.parent_id,
				},
				// TODO: probably a bad key mapping here.
				defaults: i18nOptions,
			})
			.then(() => {
				return instance.reload();
			})
			.catch(error => instance.destroy({ force: true }).then(() => error));		
	}

	afterDefine() {
		this.sequelize.afterDefine('afterDefine_i18n', (model) => {			

			if (this.i18nModels[model.name]) {
				const i18nModel = this.i18nModels[model.name].base;
				const i18nRealModel = this.sequelize.models[i18nModel.name];

				if(i18nModel) {
					model.i18nModel = i18nModel;					

					this.sequelize.models[model.name].hasMany( i18nRealModel, {
						as: i18nRealModel.name,
						foreignKey: 'parent_id',
						unique: 'i18n_unicity_constraint',
					});
					
					model.addHook('beforeFind','beforeFind_i18n', this.beforeFind);					
					model.addHook('afterCreate','afterCreate_i18n', this.afterCreate);
					model.addHook('afterUpdate','afterUpdate_i18n', this.afterUpdate);
					model.addHook('afterDestroy','afterDelete_i18n', this.afterDelete);		
					
					//add ability to add a translation for another language			
					model.prototype.addI18N = function (newValues, languageID) {				
						const instance = this;
						const model = this.sequelize.models[this.constructor.getTableName()];
						const i18nModel = model.i18nModel;						
						const baseOptions = this.sequelize.options.i18nOptions || {};

						if (!newValues || !i18nModel || !languageID || !baseOptions || !_.includes(baseOptions.languages, languageID)) return;
						
						const i18nOptions = {
							language_id: languageID,
							parent_id: instance.id,
						};

						const whereClause = _.assign(i18nOptions);

						if (i18nModel.model) {
							Object.keys(newValues).forEach((prop) => {
								if (prop in i18nModel.model) i18nOptions[prop] = newValues[prop];
							});
						}		

						return this
							.sequelize
							.models[i18nModel.name]
							.findOrCreate({
								where: whereClause,								
								defaults: i18nOptions,
							})
							.then(() =>	instance.reload())
							.catch(error => error);						
					};

					//add ability to remove a translation for another language			
					model.prototype.deleteI18N = function (languageID) {				
						const instance = this;
						
						if (!languageID) return;								

						return this
							.sequelize
							.models[i18nModel.name]
							.destroy({
								where: {
									language_id: languageID,
									parent_id: instance.id,
								}
							})
							.then(() =>	instance.reload())
							.catch(error => error);						
					};

					//add ability to remove a translation for another language			
					model.prototype.getI18N = function (languageID) {	
						const model = this.sequelize.models[this.constructor.getTableName()];
						const i18nModel = model.i18nModel;					

						if(!i18nModel) return

						return _.find(this[i18nModel.name],['language_id', languageID]);
					};
				}
			}
		});
	}

	afterDelete(instance, options, fn) {   
		const i18nModel = this.i18nModel;

		if (i18nModel === null) return;

		return this
			.sequelize
			.models[i18nModel.name]
			.destroy({
				where: {
					parent_id: instance.id,
				},
			}); 
	}

	afterUpdate(instance, options) {   
		const i18nModel = this.i18nModel;

		if (i18nModel === null) return;

		const i18nOptions = {};
		const baseOptions = this.sequelize.options.i18nOptions || {};

		if (instance && instance.dataValues && i18nModel.model) {
			Object.keys(instance.dataValues).forEach((prop) => {
				if (prop in i18nModel.model) i18nOptions[prop] = instance.dataValues[prop];
			});

			i18nOptions.language_id = options.language_id || baseOptions.defaultLanguage;
			i18nOptions.parent_id = instance.dataValues.id;
		}

		return this
			.sequelize
			.models[i18nModel.name]
			.upsert(i18nOptions)
			.then(() =>	instance.reload());
	}

	beforeDefine() {
		this.sequelize.beforeDefine('beforeDefine_i18n', (model, options) => {
			const mutableModel = model;
			const mutableOptions = options;
			const baseOptions = {
				indexes: [],
				underscored: mutableOptions.i18n? (mutableOptions.i18n.underscored && true): true,
			};
			const pk = this.getModelUniqueKey(mutableModel);		

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
				const name = this.getI18NName(mutableOptions.modelName);
				const createdModel = this.createI18NModel(
					name,
					schema,
					baseOptions,
					mutableOptions.modelName,
				);

				this.i18nModels[mutableOptions.modelName] = createdModel;

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

	beforeFind(options) {    
		const mutableOptions = options;
		const i18nModel = this.i18nModel;				

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
						if (prop !== 'language_id' && prop !== 'parent_id' && prop !== 'id') {
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
			if (!lang && !this.baseOptions.defaultLanguage) throw new Error('No language given');
			if (!propertyName) throw new Error('Property name to update is missing');

			const currentObjectID = this.id;
			const options = {
				parent_id: currentObjectID,
				language_id: lang,
			};

			options[propertyName] = value;

			this.sequelize.models[modelName].upsert(options).then((result) => {
				if (callback && (typeof callback === 'function')) callback(result);
			});
		};
	}
}

module.exports = SequelizeI18N;