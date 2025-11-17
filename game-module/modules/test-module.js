export default {
    async init() {
      console.log('[test] Module initialized');
    },
  
    test() {
      console.log('[test] Test function called!');
    },

    echo(string) {
      return `${string}`
    }
  };
  
