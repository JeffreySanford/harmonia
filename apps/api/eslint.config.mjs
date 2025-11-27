import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			'@angular-eslint/prefer-inject': 'off'
		}
	}
];
