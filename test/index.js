'use strict';

const should = require('chai').should();
const Sequelize = require('sequelize');
const utils = require('../lib/utils');
require('mocha');

const languages = {
    list: ["FR", "EN", "ES"],
    default: "FR"
};

let sequelize;
let Model;
let i18n;
let instance;

describe('Utils methods', function () {

    it('should return the i18n model name', function () {
        utils.getI18nName('test').should.equal('test_i18n');
    });

    it('toArray() of null should return an empty array', function () {
        const result = utils.toArray(null);
        Array.isArray(result).should.equal(true);
        result.length.should.equal(0);
    });

    it('toArray() of an empty array should return an empty array', function () {
        const result = utils.toArray([]);
        Array.isArray(result).should.equal(true);
        result.length.should.equal(0);
    });

    it('toArray() of an object should return an array containing the object at index 0', function () {
        const obj = 5;
        var result = utils.toArray(obj);
        Array.isArray(result).should.equal(true);
        result.length.should.equal(1);
        result[0].should.equal(obj);
    });

    it('getLanguageArrayType() of an array of strings should return "STRING" ', function () {
        const result = utils.getLanguageArrayType(['FR', 'EN']);
        result.should.equal("STRING");
    });

    it('getLanguageArrayType() of an array of numbers should return "INTEGER" ', function () {
        const result = utils.getLanguageArrayType([1, 2]);
        result.should.equal("INTEGER");
    });

    it('getLanguageArrayType() of an array of mixed object should return "STRING" ', function () {
        const result = utils.getLanguageArrayType(["1", 2]);
        result.should.equal("STRING");
    });
});

describe('Sequelize', function () {

    it('should be connected to database', function () {

        sequelize = new Sequelize('', '', '', {
            dialect: 'sqlite',
            //storage: 'database.test.sqlite',
            logging: false
        });

        sequelize
            .authenticate()
            .then(function (err) {
                console.log('Connection has been established successfully.');
            })
            .catch(function (err) {
                console.log('Unable to connect to the database:', err);
            });

    });

    it('should init i18n module', function () {
        var Sequelize_i18n = require('../index.js');
        i18n = new Sequelize_i18n(sequelize, {languages: languages.list, default_language: languages.default});
        i18n.init();
    });

    it('should add the given model', function () {
        Model = require('./model/model')(sequelize);
    });

    it('should have imported the exemple model', function () {
        sequelize.models.should.have.property('model');
    });

});

describe('Sequelize-i18n', function () {

    it('i18n should have the correct languages list', function () {

        i18n.languages.length.should.equal(languages.list.length);
        var is_equal = true;

        for (var i = 0; i < languages.list.length; i++) {
            i18n.languages[i].should.equal(languages.list[i]);
        }
    });

    it('i18n should have "' + languages.default + '" as default language', function () {
        i18n.default_language.should.equal(languages.default);
    });

    it('should have created the model i18n table', function () {
        sequelize.models.should.have.property('model_i18n');
    });

    it('should synchronize database', function (done) {
        sequelize.sync({force: true})
            .then(function () {
                done();
            })
            .catch(function (error) {
                done(error);
            });
    });

    it('should have a "model" and "model_i18ns" table', function (done) {
        sequelize.showAllSchemas()
            .then(function (result) {
                result.should.not.equal(null);
                result.length.should.equal(2);
                result[0].should.equal('model');
                result[1].should.equal('model_i18ns');
                done();
            })
    });

});

describe('Sequelize-i18n create', function () {
    it('should return the created model with the i18n property', function (done) {
        Model.create({
                id: 1,
                label: 'test',
                reference: "xxx"
            })
            .then(function (result) {
                if (result) {
                    instance = result;
                    return done();
                }
            })
            .catch(function (error) {
                done(error);
            })
    });
});

describe('Sequelize-i18n find', function () {
    it('should return i18n values', function () {
        return Model.findById(1).then(function (result) {
            result.should.have.property('model_i18n');
            result['model_i18n'].length.should.equal(1);
            result['model_i18n'][0].should.have.property('label');
            result['model_i18n'][0]['label'].should.equal("test");
        }).catch(function (e) {
            console.log('erreur : ' + e);
        });
    });

    it('should return i18n values when filter on field i18n', function () {
        return Model.findOne({where: {label: "test"}}).then(function (result) {
            result.should.have.property('model_i18n');
            result['model_i18n'].length.should.equal(1);
            result['model_i18n'][0].should.have.property('label');
            result['model_i18n'][0]['label'].should.equal("test");
        }).catch(function (e) {
            console.log('erreur : ' + e);
        });
    });

});


describe('Sequelize-i18n update', function () {
    it('should set the name property to test2 for default language', function () {
        return instance.update({label: "test-fr-update"}, {language_id: "FR"}).then(function (res) {
            instance.get_i18n("FR").label.should.equal('test-fr-update');
        })
    });

    it('should set the name property to test-en-update for EN', function () {
        return instance.update({label: "test-en-update"}, {language_id: "EN"}).then(function (res) {
            return Model.find({where: {id: 1}})
                .then(function (_result) {
                    _result.get_i18n("EN").label.should.equal('test-en-update');
                })
        })
    });
});


describe('Sequelize-i18n delete', function () {
    it('should delete current instance and its i18n values', function () {
        return instance.destroy();
    });
});
