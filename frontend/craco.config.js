module.exports = {
  babel: {
    plugins: [
      ['babel-plugin-react-compiler', { target: '18' }],
    ],
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^axios$': 'axios/dist/node/axios.cjs',
      },
    },
  },
};

