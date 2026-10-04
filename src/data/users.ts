export const APP_USERS = [
  { username: 'Cheick', password: '123', role: 'admin' },
  { username: 'Samba', password: '432', role: 'admin' },
  { username: 'Amara', password: 'a1111', role: 'utilisateur' },
  { username: 'Ousmane', password: 'o8801', role: 'utilisateur' },
];

export const authenticateUser = (username, password) => {
  return APP_USERS.find(u => u.username === username && u.password === password);
};

export const listUsers = () => APP_USERS;
