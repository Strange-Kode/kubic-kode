export default {
    async validate() {
      console.log('[auth] Validating config...');
    },
  
    async init() {
      console.log('[auth] Module initialized');
    },
  
    async login(user, pass) {
      console.log(`[auth] Logging in ${user}`);
      return { user, token: 'abc123' };
    }
  };
  