# sequelize-i18n

> Easily set up internalization using [sequelize](https://github.com/sequelize/sequelize)


## Installation

Install with [npm](https://npmjs.org/package/sequelize-i18n)

```
npm install sequelize-i18n --save
```


## Usage


###Model definition

Define your models as usal using sequelize, simply set i18n property to true for the internationnalised fields :
```
var Product = function (sequelize, DataTypes) {
    var Product = sequelize.define('product', {
        id : {
            type 			: DataTypes.BIGINT,
            primaryKey 		: true,
            autoIncrement 	: true
        },
        name : {
            type 			: DataTypes.STRING,
            i18n		 	: true
        },
        reference : {
            type 			: DataTypes.STRING
        }
    },
    
    { /* options */ });
    return Product;
};


module.exports = function(sequelize) {
    return sequelize.import('product', Product)
};
```


### Initialisation

Init Sequelize-i18n module before importing models

```js
var Sequelize = require('sequelize');
var SequelizeI18N = require('sequelize-i18n');

var languages = { 
	list : ["EN" , "FR" , "ES"] , 
	default : "FR" 
};

// Init Sequelize
sequelize = new Sequelize( "db_name" , "user" , "password" );

// Init i18n
i18n = new SequelizeI18N( sequelize, { languages: languages.list, default_language: languages.default } );
i18n.init();

// Import models in sequelize
var ProductModel = sequelize.import('product', Product)
```

### Options

 - **languages** ( Array ) - List of allowed languages IDs
 - **default_language** ( Object ) - Default language ID
 - **i18n_default_scope** ( Boolean = true ) - Add i18n to the model default scope
 - **add_i18n_scope** ( Boolean = true ) - Add i18n scope to model
 - **inject_i18n_scope** ( Boolean = true ) - Inject i18n to model scopes
 - **default_language_fallback** ( Boolean = true ) - Fall back to default language if we can't find a value for the given language in get_i18n method

## How it works
----------

Sequelize-i18n will check for i18n property in your models properties.
If i18n is set to true, it will create an new table in which internationalized values for the property will be store.

Example :
The given the above exemple "Product",

    name : {
        type 		: DataTypes.STRING,
        i18n		: true,
    }

A Product_i18n Sequelize model will be create, with the following columns:

 - id : the row unique identifier ( INTEGER )
 - language_id : Identifies the language of the current translation ( INTEGER OR STRING )
 - parent_id : id of the targeted product  ( Same the Product model primary key or unique key )
 - name : i18n value ( Same as Product.name.type )

The "name" property type will be set to VIRTUAL

Sequelize-i18n will set hooks into models on create, find, update and delete operations.

### Creation

    ProductModel.create({
         id: 1,
         name: 'test',
         reference: "xxx"
     })
     .then(function (result)  {
         // result.product_i18n == [ {name : "test" , lang : "FR" } ]
     })

### Update 

    product_instance.update( { name : "new name" }  )
    .then( function( result ) {
	    // result.product_i18n = [ {name : "french name" , language_id : "FR" } ]
    }
     
    product_instance.update( { name : "english name" } , { language_id : "EN" }  )
    .then( function( result ) {
        /*
        result.product_i18n == [ 
	        {name : "french name" , language_id : "FR" } ,
	        {name : "english name" , language_id : "EN" }
        ]
        */
    }

### Find

    Product.find({ where : { id : 1 } })
    .then( function( result ) {
	    /*
        result.product_i18n == [ 
	        {name : "french name" , language_id : "FR" } ,
	        {name : "english name" , language_id : "EN" }
        ]
        */
    });

### Delete

Deleting a Product instance will also delete i18n values



### get_i18n instance method

An Sequelize instance method is added to the Sequelize model in order to set virtual i18n property in the lanuage you want.

    product_instance.get_i18n( "EN" );
    // product_instance.name == "english name"
    
    product_instance.get_i18n( "FR" );
    // product_instance.name == "french name"
    
    product_instance.get_i18n( "ES" );
    // product_instance.name == "" if options.default_language_fallback is set to false
    // product_instance.name == "french name" if options.default_language_fallback is set to true