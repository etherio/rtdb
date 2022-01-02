const auth = firebase.auth(),
  db = firebase.database(),
  s3 = firebase.storage();

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
  },
  methods: {
    handleAuth(userOrNull) {
      this.loggedIn = !!userOrNull;
      this.currentUser = userOrNull;
      this.loggedIn && this.refreshToken();
    },
    signIn() {
      const { email, password } = this.login;
      this.login.error = '';
      auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
          this.login.error = err.message;
        })
    },
    signOut() {
      auth.signOut();
    },
    async refreshToken() {
      this.accessToken = await auth.currentUser.getIdToken();
    },
    selectAll(event) {
      event.target.select();
    },
    fetchDbs() {
      this.page = 'my_database';
      db.ref('users')
        .child(this.currentUser.uid)
        .child('dbs')
        .get()
        .then(data => {
          this.dbs = Object.entries(
            data.val() || {}
          ).map(
            ([id, value]) => ({
              id, _displayed: false, ...value
            })
          ).reverse();
        });
    },
    reloadDb() {
      return this.fetchDbs();
    },
    createDb() {
      db.ref('users')
        .child(this.currentUser.uid)
        .child('dbs')
        .push({ 
          ...this.created,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
        })
        .then(() => {
          this.created.databaseUrl = '';
          this.created.secretToken = '';
          this.reloadDb();
        });
    },
    deleteDb({ id }) {
      if (!confirm('Are you sure to delete this database?')) return;
      db.ref('users')
        .child(this.currentUser.uid)
        .child('dbs')
        .child(id)
        .remove()
        .then(() => this.reloadDb())
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
  },
}).$mount('#app');