export function ActionPointComponent(entity, initialAP = 100) {
    entity.ap = {
        amount: initialAP,
        spend: function (amount) {
            let new_ap = this.amount - amount;
            if (new_ap < 0) {
                return false;
            }
            this.amount = new_ap;
            return true;
        }
    };
}

ActionPointComponent.componentName = 'ap';
