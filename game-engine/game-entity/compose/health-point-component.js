export function HealthPointComponent(entity, initialHP = 100) {
  entity.hp = {
    amount: initialHP,
    spend: function (amount) {
      let new_hp = this.amount - amount;
      if (new_hp < 0) {
        entity.hp = 0;
        return true;
      }
      this.amount = new_hp;
      return true;
    }
  };
}

HealthPointComponent.componentName = 'hp';
