/**
 * Export all hook methods
 */

module.exports = {
    beforeDefine : require('./before-define'),
    afterDefine : require('./after-define'),
    beforeFind : require('./before-find'),
    afterCreate : require('./after-create'),
    afterUpdate : require('./after-update'),
    afterDelete : require('./after-delete'),
};