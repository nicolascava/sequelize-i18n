var _ = require("lodash");

module.exports = {
    
    /**
     * Return i18n model name from the children model name
     */ 
    getI18nName : function( model_name ) {
        return model_name + "_i18n";
    },
    
    /**
     * Takes Object as parameter and return an array containing the given object, or an empty array if object was null
     */
    toArray : function( obj ) {
        return obj ? (Array.isArray(obj) ? obj : [obj]) : [];
    },
    
    /**
    * Return the type of the elements in an array
    */
    getLanguageArrayType : function( arr ) {
        var is_number = true;
        for( var i = 0 ; i < arr.length ; i++ ) {
            if( typeof arr[i] !== "number" ) is_number = false;
        }
        return is_number ? 'INTEGER' : 'STRING';
    },
    
    /**
     * Return the primary key or a unique key of the given model
     */
    getModelUniqueKey : function( model ) {
        // Get model primary or unique key
        var pk = _.filter( model , function( o ) { return o.primaryKey === true } );
        if( ! (pk && pk.length) ) {
            pk = _.filter( model , function( o ) { return o.unique === true } );
        }
        pk = pk[0] || null;
        return pk;
    }
    
}