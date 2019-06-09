# Sequelize i18n

> Easy internalization using Sequelize

## Usage

### Model definition

As usual, define your models using [Sequelize](http://docs.sequelizejs.com). Simply set the i18n property to `true` to enable internationalized fields:

```javascript
const product = (sequelize, DataTypes) =>
  sequelize.define('product', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      i18n: true,
    },
    reference: {
      type: DataTypes.STRING,
    },
  }, {});

export default function(sequelize) {
  return sequelize.import('product', product);
}
```

### Initialisation

Just set the Sequelize i18n module before importing models:

```javascript
import Sequelize from 'sequelize';
import SequelizeI18N from 'sequelize-i18n';

const languages = {
  list: ['EN', 'FR', 'ES'],
  default: 'FR',
};
const sequelize = new Sequelize('db_name', 'user', 'password');
const i18n = new SequelizeI18N(sequelize, {
  languages: languages.list,
  defaultLanguage: languages.default,
});

i18n.init();

const ProductModel = sequelize.import('product', product)
```

### Options

* `languages`: list of allowed languages IDs.
* `defaultLanguage`: default language ID.
* `i18nDefaultScope`: add i18n to the default model scope.
* `addI18NScope`: add i18n scope to model.
* `injectI18NScope`: inject i18n to model scopes.

### Model Options

This options can be set at the model level when defining them.
Those are used in the `i18n` parameter. 

example: 

```javascript
i18n: {
				underscored: false,
			}
```

* `underscored`: set the value of `underscored` option in sequelize when generating the table name.


## How it works

Sequelize i18n will check for i18n property in your model.
If i18n is enabled, it will create a new table in which property's internationalized values will be stored.

Starting from the above example `Product`.

```javascript
{
  name: {
    type: DataTypes.STRING,
    i18n: true,
  },
}
```

A `product_i18n` model will be created, with the following columns:

* `id`: the unique row identifier (`INTEGER`).
* `language_id`: identifies the current translation language (`INTEGER` or `STRING`).
* `parent_id`: the targeted product id (same as the model primary or unique key).
* `name`: the i18n value (same as `Product.name.type`).

The `name` property type is set to `VIRTUAL`.
The `language_id` property type is added as `VIRTUAL` into `Product`.

Sequelize i18n will set hooks into models on `create`, `find`, `update`, and `delete` operations.

If `language_id` is added to the options of a query of type `Find` (`FindAll`, `FindOne` etc ...), language ID will be hard-coded for each instance in the column `language_id`.
This way, the requested language can be used in the results (convenient for use with GraphQL for example).
If the where clause includes `language_id`, the same behavior will happen so it does not need to be added as an option to the `Find` command.

Sequelize i18n will add the functions below to the model:

* `getI18N(language)`: Get the translation row for a given language
* `AddI18N(values, language)`: Add a new translation using a different language ID. Values represents the fields to add in the form of `{field: value, field2: value}`
* `DeleteI18N(language)`: Remove the translation row for a given language. 

### Creation

```javascript
ProductModel
  .create({
    id: 1,
    name: 'test',
    reference: 'xxx',
  })
  .then((result) => {
    // [{ name: 'test', lang: 'FR' }]
    console.info(result.product_i18n);
  });
```

OR

```javascript
ProductModel
  .create({
    id: 1,
    name: 'test',
    reference: 'xxx',
  })
  .then((result) => {
    // [{ name: 'test', lang: 'FR' }]
    console.info(result.getI18N('FR'));
  });
```

### Add new Translation

```javascript
productInstance
  .AddI18N({name: 'test EN' }, 'EN')
  .then((result) => {
    // ...
  });
```

### Update 

```javascript
productInstance
  .update({ name: 'New Name' })
  .then((result) => {
    // ...
  });

productInstance
  .update({ name: 'New Name' }, { language_id: 'EN' })
  .then((result) => {
    // ...
  });
```

### Delete 

```javascript
productInstance
  .deleteI18N('EN')
  .then((result) => {
    // ...
  });
```

### Find requests

```javascript
ProductModel
  .finAll({
	  where: whereClauseObject,
	  language_id: 'EN',
  })
  .then((result) => {
    // 'EN'
    console.info(result.language_id);
  });
```

OR

```javascript
ProductModel
  .finAll({
	  where: {
			id: 'XXXX',
			language_id: 'EN',
	  },	  
  })
  .then((result) => {
    // 'EN'
    console.info(result.language_id);
  });
```
    
## License

The MIT License (MIT)

Copyright (c) 2018 Nicolas Cava

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
