import Sequelize from 'sequelize';
import chai from 'chai';

import SequelizeI18N from '../';
import Model from './Model';

chai.should();

const languages = {
  list: ['FR', 'EN', 'ES'],
  default: 'FR',
};

let sequelize = null;
let i18n = null;
let instance = null;
let TestModel = null;

describe('SequelizeI18N', () => {
  beforeEach(async () => {
    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      logging: false,
    });

    await sequelize.authenticate();

    i18n = new SequelizeI18N(sequelize, {
      languages: languages.list,
      defaultLanguage: languages.default,
    });

    i18n.init();

    TestModel = Model(sequelize);

    await sequelize.sync({ force: true });

    instance = await TestModel.create({
      id: 1,
      label: 'test',
      reference: 'xxx',
    });
  });

  it('`getI18NName()` should return the i18n model name', () =>
    SequelizeI18N.getI18NName('test').should.equal('test_i18n'));

  it('`toArray()` of `null` should return an empty array', () => {
    const result = SequelizeI18N.toArray(null);

    Array.isArray(result).should.equal(true);
    result.length.should.equal(0);
  });

  it('`toArray()` of an empty array should return an empty array', () => {
    const result = SequelizeI18N.toArray([]);

    Array.isArray(result).should.equal(true);
    result.length.should.equal(0);
  });

  it('`toArray()` of an object should return an array that contains the object at index 0', () => {
    const obj = 5;
    const result = SequelizeI18N.toArray(obj);

    Array.isArray(result).should.equal(true);
    result.length.should.equal(1);
    result[0].should.equal(obj);
  });

  it('`getLanguageArrayType()` of an array of strings should return `STRING`', () => {
    const result = SequelizeI18N.getLanguageArrayType(['FR', 'EN']);

    result.should.equal('STRING');
  });

  it('`getLanguageArrayType()` of an array of numbers should return `INTEGER`', () => {
    const result = SequelizeI18N.getLanguageArrayType([1, 2]);

    result.should.equal('INTEGER');
  });

  it('`getLanguageArrayType()` of an array of mixed objects should return `STRING`', () => {
    const result = SequelizeI18N.getLanguageArrayType(['1', 2]);

    result.should.equal('STRING');
  });

  it('should have imported the example model', () =>
    sequelize.models.should.have.property('model'));

  it('i18n should have the correct language list', () => {
    i18n.languages.length.should.equal(languages.list.length);

    for (let index = 0; index < languages.list.length; index += 1) {
      i18n.languages[index].should.equal(languages.list[index]);
    }
  });

  it(`i18n should have \`${languages.default}\` as default language`, () =>
    i18n.defaultLanguage.should.equal(languages.default));

  it('should have created the i18n model table', () =>
    sequelize.models.should.have.property('model_i18n'));

  it('should have a `model` and `model_i18ns` tables', (done) => {
    sequelize
      .showAllSchemas()
      .then((result) => {
        result.should.not.equal(null);
        result.length.should.equal(2);
        result[0].should.equal('model');
        result[1].should.equal('model_i18ns');

        done();
      })
      .catch(error => done(error));
  });

  it('should return the created model with the i18n property', (done) => {
    TestModel
      .create({
        id: 2,
        label: 'test',
        reference: 'xxx',
      })
      .then(() => done())
      .catch(error => done(error));
  });

  it('should return i18n values', () =>
    TestModel
      .findById(1)
      .then((result) => {
        result.should.have.property('model_i18n');
        result.model_i18n.length.should.equal(1);
        result.model_i18n[0].should.have.property('label');
        result.model_i18n[0].label.should.equal('test');
      })
      .catch(() => {}));

  it('should return i18n values when the filter is on the i18n field', () =>
    TestModel
      .findOne({ where: { label: 'test' } })
      .then((result) => {
        result.should.have.property('model_i18n');
        result.model_i18n.length.should.equal(1);
        result.model_i18n[0].should.have.property('label');
        result.model_i18n[0].label.should.equal('test');
      })
      .catch(() => {}));

  it('should delete current instance and its i18n values', () => instance.destroy());
});
