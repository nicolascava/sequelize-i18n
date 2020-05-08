import Sequelize from "sequelize";
import chai from "chai";
import fs from "fs";

import SequelizeI18N from "..";
import Models from "./Models";

chai.should();
chai.use(require("chai-like"));
chai.use(require("chai-things"));

const languages = {
  list: ["FR", "EN", "ES"],
  default: "FR",
};

let sequelize = null;
let i18n = null;
let instance = null;
let table1 = null;
let table2 = null;

describe("SequelizeI18N", () => {
  beforeEach(async () => {
    const dbFile = `${__dirname}/.test.sqlite`;

    try {
      fs.unlinkSync(dbFile);
    } catch (error) {
      console.error(error);
    }

    sequelize = new Sequelize("", "", "", {
      dialect: "sqlite",
      storage: dbFile,
      logging: false,
    });

    await sequelize.authenticate();

    i18n = new SequelizeI18N(sequelize, {
      languages: languages.list,
      defaultLanguage: languages.default,
    });

    i18n.init();

    const models = Models(sequelize);

    table1 = models.table1;
    table2 = models.table2;

    await sequelize.sync({ force: true });

    instance = await table1
      .create({
        id: 1,
        label: "test",
        description: "c'est un test",
        reference: "xxx",
      })
      .then((inst) =>
        inst.addI18N({ label: "test EN", description: "This is a test" }, "EN")
      );

    await table2.create({
      id: 1,
      label: "test2",
      description: "test 2",
      reference: "yyy",
    });
  });

  it("`getI18NName()` should return the i18n table1 name", () => {
    i18n.getI18NName("random").should.equal("random_i18n");
  });

  it("`toArray()` of `null` should return an empty array", () => {
    const result = i18n.toArray(null);

    Array.isArray(result).should.equal(true);
    result.length.should.equal(0);
  });

  it("`toArray()` of an empty array should return an empty array", () => {
    const result = i18n.toArray([]);

    Array.isArray(result).should.equal(true);
    result.length.should.equal(0);
  });

  it("`toArray()` of an object should return an array that contains the object at index 0", () => {
    const obj = 5;
    const result = i18n.toArray(obj);

    Array.isArray(result).should.equal(true);
    result.length.should.equal(1);
    result[0].should.equal(obj);
  });

  it("`getLanguageArrayType()` of an array of strings should return `STRING`", () => {
    const result = i18n.getLanguageArrayType();

    result.should.equal("STRING");
  });

  it("should have imported the example table1", () => {
    sequelize.models.should.have.property("table1");
  });

  it("i18n should have the correct language list", () => {
    i18n.options.languages.length.should.equal(languages.list.length);

    for (let index = 0; index < languages.list.length; index += 1) {
      i18n.options.languages[index].should.equal(languages.list[index]);
    }
  });

  it(`i18n should have \`${languages.default}\` as default language`, () => {
    i18n.options.defaultLanguage.should.equal(languages.default);
  });

  it("should have created the i18n table1 table", () => {
    sequelize.models.should.have.property("table1_i18n");
  });

  it("should have a `table1`, `table1_i18ns` and `table2` tables", (done) => {
    sequelize
      .showAllSchemas()
      .then((result) => {
        result.should.not.equal(null);
        result.length.should.equal(3);
        result.should.be
          .an("array")
          .that.contains.something.like({ name: "table1" });
        result.should.be
          .an("array")
          .that.contains.something.like({ name: "table1_i18ns" });
        result.should.be
          .an("array")
          .that.contains.something.like({ name: "table2" });
        done();
      })
      .catch((error) => done(error));
  });

  it("should return i18n values", (done) => {
    table1
      .findByPk(1)
      .then((result) => {
        result.should.have.property("table1_i18n");
        result.table1_i18n.length.should.equal(2);
        result.table1_i18n.should.be.an("array").that.contains.something.like({
          label: "test",
          description: "c'est un test",
        });
        result.table1_i18n.should.be.an("array").that.contains.something.like({
          label: "test EN",
          description: "This is a test",
        });
        done();
      })
      .catch((e) => e);
  });

  it("should return i18n values when the filter is on the i18n field", (done) => {
    table1
      .findOne({ where: { label: "test" } })
      .then((result) => {
        result.should.have.property("table1_i18n");
        result.table1_i18n.length.should.equal(1);
        result.table1_i18n[0].should.have.property("label");
        result.table1_i18n[0].label.should.equal("test");

        done();
      })
      .catch((e) => e);
  });

  it("should return English i18n values when the filter has include", (done) => {
    table1
      .findOne({
        include: [
          {
            model: sequelize.models.table1_i18n,
            as: "table1_i18n",
            where: { language_id: "EN" },
          },
        ],
      })
      .then((result) => {
        result.should.have.property("table1_i18n");
        result.table1_i18n[0].should.have.property("description");
        result.table1_i18n[0].description.should.equal("This is a test");

        done();
      })
      .catch((e) => e);
  });

  it("should return English i18n values using the function", (done) => {
    table1
      .findByPk(1)
      .then((result) => {
        const i18nResult = result.getI18N("EN");

        i18nResult.should.have.property("description");
        i18nResult.description.should.equal("This is a test");
        done();
      })
      .catch((e) => e);
  });

  it("should return updated English i18n values", (done) => {
    table1
      .findByPk(1)
      .then((result) =>
        result.update({ label: "Test EN renamed" }, { language_id: "EN" })
      )
      .then((upd) => {
        const i18nUpdate = upd.getI18N("EN");

        i18nUpdate.should.have.property("label");
        i18nUpdate.should.have.property("description");
        i18nUpdate.description.should.equal("This is a test");
        i18nUpdate.label.should.equal("Test EN renamed");
        done();
      })
      .catch((e) => e);
  });

  it("should return the hard-coded language ID", (done) => {
    table1
      .findByPk(1, { language_id: "EN" })
      .then((r) => {
        r.should.have.property("language_id");
        r.language_id.should.equal("EN");
        done();
      })
      .catch((e) => e);
  });

  it("should delete current instance and its i18n values", () => {
    instance.destroy();
  });
});

describe("SequelizeI18N with a different suffix", () => {
  beforeEach(async () => {
    const dbFile = `${__dirname}/.test2.sqlite`;

    try {
      fs.unlinkSync(dbFile);
    } catch (e) {
      console.error(e);
    }

    sequelize = new Sequelize("", "", "", {
      dialect: "sqlite",
      storage: dbFile,
      logging: false, // console.log,
    });

    await sequelize.authenticate();

    i18n = new SequelizeI18N(sequelize, {
      languages: languages.list,
      defaultLanguage: languages.default,
      suffix: "-international",
    });

    i18n.init();

    const models = Models(sequelize);

    table1 = models.table1;
    table2 = models.table2;

    await sequelize.sync({ force: true });

    instance = await table1
      .create({
        id: 1,
        label: "test",
        description: "c'est un test",
        reference: "xxx",
      })
      .then((inst) =>
        inst.addI18N({ label: "test EN", description: "This is a test" }, "EN")
      );
  });

  it("`getI18NName()` should return the i18n name for that table", () => {
    i18n.getI18NName("random").should.equal("random-international");
  });

  it("should have created the international table1 table", () => {
    sequelize.models.should.have.property("table1-international");
  });

  it("should have a `table1` and `table1-international` tables", (done) => {
    sequelize
      .showAllSchemas()
      .then((result) => {
        result.should.not.equal(null);
        result.length.should.equal(3);
        result.should.be
          .an("array")
          .that.contains.something.like({ name: "table1" });
        result.should.be
          .an("array")
          .that.contains.something.like({ name: "table1-internationals" });

        done();
      })
      .catch((error) => done(error));
  });

  it("should return i18n values", (done) => {
    table1
      .findByPk(1)
      .then((result) => {
        result.should.have.property("table1-international");
        result["table1-international"].length.should.equal(2);
        result["table1-international"].should.be
          .an("array")
          .that.contains.something.like({
            label: "test",
            description: "c'est un test",
          });
        result["table1-international"].should.be
          .an("array")
          .that.contains.something.like({
            label: "test EN",
            description: "This is a test",
          });
        done();
      })
      .catch((e) => e);
  });

  it("should return i18n values when the filter is on the i18n field", (done) => {
    table1
      .findOne({ where: { label: "test" } })
      .then((result) => {
        result.should.have.property("table1-international");
        result["table1-international"].length.should.equal(1);
        result["table1-international"][0].should.have.property("label");
        result["table1-international"][0].label.should.equal("test");
        done();
      })
      .catch((e) => e);
  });

  it("should delete current instance and its i18n values", () => {
    instance.destroy();
  });
});
