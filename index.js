const auth = firebase.auth(),
  db = firebase.database(),
  s3 = firebase.storage();

const ls = {
  _dbKey: '__ls:db',
  _fallback: undefined,
  get db() {
    return unserialize(localStorage.getItem(this._dbKey) || this._fallback);
  },
  set db(value) {
    localStorage.setItem(this._dbKey, serialize(value));
  },
  clearDb() {
    localStorage.clear();
  },
};

new Vue({
  data: {
    page: 'user_profile',
    loggedIn: undefined,
    currentUser: undefined,
    login: {
      email: '',
      password: '',
      error: '',
    },
    accessToken: undefined,
    currentDate: new Date(),
    dbs: [],
    created: {
      databaseUrl: '',
      secretToken: '',
    },
    selectedDb: undefined,
  },
  methods: {
    handleAuth(userOrNull) {
      this.loggedIn = !!userOrNull;
      this.currentUser = userOrNull;
      this.loggedIn && this.refreshToken();
    },
    async signIn() {
      this.login.error = '';  
      try {
        const { email, password } = this.login;
        await auth
          .signInWithEmailAndPassword(
            email,
            password
          );
      } catch (e) {
        this.login.error = e.message;
      }
    },
    signOut() {
      return auth.signOut();
    },
    async refreshToken() {
      this.accessToken = await auth
        .currentUser
        .getIdToken();
    },
    selectAll(event) {
      event.target.select();
    },
    async fetchDbs() {
      const ss = await db.ref('users')
        .child(this.currentUser.uid)
        .child('dbs')
        .get();
      this.selectedDb = ls.db;
      this.page = 'my_database';
      this.dbs = Object
        .entries(ss.val() || {})
        .map(
          ([id, value]) => ({
            id,
            ...value,
            _displayed: false
          })).reverse();
    },
    reloadDb() {
      return this.fetchDbs();
    },
    async createDb() {
      const created = this.created;
      await testConnection(created);
      await db.ref('users')
        .child(this.currentUser.uid)
        .child('dbs')
        .push({ ...created, createdAt: firebase.database.ServerValue.TIMESTAMP });
      this.created.databaseUrl = '';
      this.created.secretToken = '';
      this.reloadDb();
    },
    async deleteDb({ id }) {
      if (!confirm('Are you sure to delete this database?')) return;
      await db.ref('users')
        .child(this.currentUser.uid)
        .child('dbs')
        .child(id)
        .remove();
      this.reloadDb();
    },
    useDb(selected) {
      if (!confirm('Are you sure to use this database?')) return;
      this.selectedDb = ls.db = selected;
    },
    clearDb() {
      ls.clearDb();
      this.selectedDb = ls.clearDb();
    }
  },
  computed: {
    decodedId() {
      return this.accessToken && JSON.parse(atob(this.accessToken.split('.')[1])) || null;
    },
    issuedDate() {
      return new Date(
        parseInt(this.decodedId.iat) * 1000
      );
    },
    expiredDate() {
      return new Date(
        parseInt(this.decodedId.exp) * 1000
      );
    },
  },
  beforeMount() {
    auth.onAuthStateChanged(
      this.handleAuth.bind(this)
    );
    setInterval(() => {
      this.currentDate = new Date();
    }, 1000);
    // setTimeout(()=>this.reloadDb(), 800);
  },
}).$mount('#app');

function testConnection({ databaseUrl, secretToken }) {
  const url = new URL(databaseUrl);
  url.searchParams.append('auth', secretToken);
  return axios.get(url.toString()).then(({ status, data }) => {
    if (status !== 200) {
      throw new Error(`Invalid HTTP Status: ${status}`);
    }
    return data;
  });
}

function serialize(obj) {
  return JSON.stringify(obj);
}

function unserialize(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return raw;
  }
}