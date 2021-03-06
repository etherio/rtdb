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
    error: null,
    dbRules: '',
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
      this.selectedDb = ls.clearDb();
    },
    async reloadDbRules() {
      this.page = 'db_rules';
      this.dbRules = '';
      this.error = null;
      try {
        const url = new URL(this.selectedDb.databaseUrl);
        url.searchParams.append('auth', this.selectedDb.secretToken);
        url.pathname = '/.settings/rules.json';
        const { data } = await axios.get(url.toString());
        this.dbRules = JSON.stringify(data, null, 2);
        requestAnimationFrame(this.highlight);
      } catch (e) {
        this.error = e.message;
      }
    },
    highlight(event) {
      try {
        const el = document.querySelector('.language-json');
        if (!el) return console.warn('highlight element not found');
        hljs.highlightElement(el);
      } catch (e) {}
    },
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
    this.selectedDb = ls.db;
  },
}).$mount('#app');

function testConnection({
  databaseUrl,
  secretToken
}) {
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

window.addEventListener('DOMContentLoaded', () => {
  const fbBtn = document.querySelector('iframe#fb-like');
  const iframeLink = new URL(fbBtn.src);
  const sharedLink = new URL(iframeLink.searchParams.get('href'));
  const params = new URLSearchParams(location.search);
  
  if (params.has('id')) {
    sharedLink.pathname = ['articles', params.get('id')].join('/');
    fbBtn.src = sharedLink.toString();
    let h = document.createElement('h5');
    let c = document.createElement('code');
    c.innerText = fbBtn.src;
    h.appendChild(c);
    document.body.appendChild(h);
  } else {
    console.log('adding id',new Date);
    location.replace('?id=509528');
  }
});