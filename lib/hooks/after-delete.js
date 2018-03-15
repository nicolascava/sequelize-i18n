module.exports = function() {
    
    var self = this;
    
    return function( instance, options , fn ) {
        
        // Get Generated model
        var i18n_model = self.getI18nModel( this.name );
        if( i18n_model == null ) return fn();
        
        self.sequelize.models[i18n_model.name].destroy({
            where : {
                parent_id : instance.id
            }
        }).then( function( _instance ) {
            fn();
        }).catch( function( error ) {
            fn( error );
        });
    };
}