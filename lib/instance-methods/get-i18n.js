/**
 * get_i18n method
 * Get i18n value for the given property
 */

module.exports = function( model_name ) {
    var self = this;
    
    return function( lang , options ) {
        
        var _exit = false;
        options = options || {};
        options.default_language_fallback = options.default_language_fallback != null ? options.default_language_fallback : self.default_language_fallback;
        
        if( self.default_language == null || !options.default_language_fallback ) _exit = true
        
        if( ! (this[model_name ] && this[model_name].length ) ) return this;
        
        for( var i = 0 ; i < this[model_name].length ; i++ ) {
            var value = this[model_name][i].toJSON();
            if( value.language_id && value.language_id == lang ) {
                _exit = true;
                for( var prop in value ) {
                    if( prop !== 'language_id' && prop !== 'parent_id' && prop !== 'id' ) {
                        this[prop] = value[prop];
                    }
                }
            }
        }
        
        if( _exit ) return this;
        
        for( var i = 0 ; i < this[model_name].length ; i++ ) {
            var value = this[model_name][i].toJSON();
            if( value.language_id && value.language_id == self.default_language ) {
                _exit = true;
                for( var prop in value ) {
                    if( prop !== 'language_id' && prop !== 'parent_id' && prop !== 'id' ) {
                        this[prop] = value[prop];
                    }
                }
            }
        }
        
        return this;
        
    }
};