/**
 * set_i18n method
 * Set i18n value for the given property
 */

module.exports = function( model_name ) {
    var self = this;
    
    return function( lang , property_name , value , callback ) {
        if( !lang && !self.default_language ) throw new Error('No language given.');
        if( !property_name ) throw new Error('Property name to update is missing.');
        
        var current_object_id = this.id;
        var options = {
            parent_id : current_object_id,
            language_id : lang
        };
        
        options[property_name] = value;
        
        this.sequelize.models[model_name].upsert(options).then( function( result ) {
            // Result === true if new row was created, false if an existing row was created
            if( callback && (typeof callback === "function")) {
                callback( result );
            }
        });
    }
};