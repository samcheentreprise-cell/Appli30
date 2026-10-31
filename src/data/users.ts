export const APP_USERS = [
  { username: 'Cheick', password: '1234', role: 'admin' },
  { username: 'Samba', password: '4321', role: 'admin' },
  { username: 'Amara', password: 'a1111', role: 'utilisateur' },
  { username: 'Ousmane', password: 'o8801', role: 'utilisateur' },
  { username: 'Djeneba', password: 'd3333', role: 'comptable' },
  { username: 'Alou', password: 'c0100', role: 'utilisateur' },
];

export const authenticateUser = (username, password) => {
  return APP_USERS.find(u => u.username === username && u.password === password);
};

export const listUsers = () => APP_USERS;
