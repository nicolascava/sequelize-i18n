module.exports = function() {
    
    var self = this;
    
    return function( instance , options , fn ) {

        // Get Base model
        var i18n_model = self.getI18nModel( this.name ) ;
        if( i18n_model == null ) return fn();
        
        // Get i18n properies
        var i18n_options = {};
        if( instance && instance.dataValues && i18n_model.model) {
            for( var prop in instance.dataValues ) {
                if( prop in i18n_model.model ) {
                    i18n_options[prop] = instance.dataValues[prop];
                }                    
            }
            i18n_options.language_id = self.default_language;
            if( "language_id" in options ) {
                i18n_options.language_id = options.language_id;
            }
            i18n_options.parent_id = instance.dataValues.id;
        }
        self.sequelize.models[i18n_model.name].findOrCreate( { 
            where : {
                language_id : i18n_options.language_id , 
                parent_id : i18n_options.parent_id 
            },
            defaults : i18n_options
            
        }).then( function( result ) {
            instance.reload().then( function() {
                fn();
            })
            
        }).catch( function( error ) {
            instance.destroy({force : true}).then(function() {
                fn(error);
            });
            
        })
    };
}