#!/usr/bin/env node

/**
 * Insighta Labs+ CLI
 * Entry point — wires up all Commander commands.
 *
 * Commands:
 *   insighta login
 *   insighta logout
 *   insighta whoami
 *   insighta profiles list    [options]
 *   insighta profiles get     <id>
 *   insighta profiles search  <query>  [options]
 *   insighta profiles create  [options]
 *   insighta profiles export  [options]
 */

import { program, Command } from 'commander';
import chalk from 'chalk';

// ── Auth handlers ────────────────────────────────────────────────────────────
import { login }  from '../src/auth/login.js';
import { logout } from '../src/auth/logout.js';
import { whoami } from '../src/auth/whoami.js';

// ── Profiles handlers ────────────────────────────────────────────────────────
import { listProfiles }   from '../src/profiles/list.js';
import { getProfile }     from '../src/profiles/get.js';
import { searchProfiles } from '../src/profiles/search.js';
import { createProfile }  from '../src/profiles/create.js';
import { exportProfiles } from '../src/profiles/export.js';

// ── Global CLI metadata ──────────────────────────────────────────────────────
program
  .name('insighta')
  .description(chalk.bold('Insighta Labs+') + ' — profile management CLI')
  .version('1.0.0', '-v, --version', 'Print the current version')
  .helpOption('-h, --help', 'Display help information')
  // Show help when no sub-command is given
  .addHelpCommand('help [command]', 'Display help for a specific command');

// ── insighta login ───────────────────────────────────────────────────────────
program
  .command('login')
  .description('Authenticate via GitHub OAuth (opens browser)')
  .action(async () => {
    try {
      await login();
    } catch (err) {
      console.error(chalk.red(`\n✖ Login failed: ${err.message}\n`));
      process.exit(1);
    }
  });

// ── insighta logout ──────────────────────────────────────────────────────────
program
  .command('logout')
  .description('Revoke the current session and clear local credentials')
  .action(async () => {
    try {
      await logout();
    } catch (err) {
      console.error(chalk.red(`\n✖ Logout failed: ${err.message}\n`));
      process.exit(1);
    }
  });

// ── insighta whoami ──────────────────────────────────────────────────────────
program
  .command('whoami')
  .description('Show the currently authenticated user')
  .action(async () => {
    try {
      await whoami();
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

// ── insighta profiles ────────────────────────────────────────────────────────
const profiles = new Command('profiles')
  .description('Manage user profiles')
  // Show help when `insighta profiles` is run with no sub-command
  .action(() => {
    profiles.help();
  });

// ── insighta profiles list ───────────────────────────────────────────────────
profiles
  .command('list')
  .description('List profiles with optional filters and pagination')
  .option('--gender <gender>',        'Filter by gender (male, female, …)')
  .option('--country <country>',      'Filter by country name')
  .option('--age-group <ageGroup>',   'Filter by age group bucket (e.g. 18-24)')
  .option('--min-age <minAge>',       'Minimum age (inclusive)')
  .option('--max-age <maxAge>',       'Maximum age (inclusive)')
  .option('--sort-by <sortBy>',       'Field to sort by (e.g. age, name, country)')
  .option('--order <order>',          'Sort order: asc or desc', 'asc')
  .option('--page <page>',            'Page number (default: 1)', parseInt)
  .option('--limit <limit>',          'Results per page (default: 20)', parseInt)
  .action(async (options) => {
    try {
      await listProfiles(options);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

// ── insighta profiles get <id> ───────────────────────────────────────────────
profiles
  .command('get <id>')
  .description('Get a single profile by its ID')
  .action(async (id) => {
    try {
      await getProfile(id);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

// ── insighta profiles search <query> ────────────────────────────────────────
profiles
  .command('search <query>')
  .description('Search profiles by name, country, or other fields')
  .option('--page <page>',   'Page number (default: 1)',    parseInt)
  .option('--limit <limit>', 'Results per page (default: 20)', parseInt)
  .action(async (query, options) => {
    try {
      await searchProfiles(query, options);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

// ── insighta profiles create ─────────────────────────────────────────────────
profiles
  .command('create')
  .description('Create a new profile')
  .requiredOption('--name <name>', 'Display name for the new profile')
  .action(async (options) => {
    try {
      await createProfile(options);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

// ── insighta profiles export ─────────────────────────────────────────────────
profiles
  .command('export')
  .description('Export profiles to a file (e.g. CSV)')
  .requiredOption('--format <format>', 'Export format (csv)')
  .option('--gender <gender>',         'Filter by gender')
  .option('--country <country>',       'Filter by country')
  .option('--age-group <ageGroup>',    'Filter by age group')
  .option('--min-age <minAge>',        'Minimum age')
  .option('--max-age <maxAge>',        'Maximum age')
  .action(async (options) => {
    try {
      await exportProfiles(options);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

// Attach the profiles sub-command group to the root program
program.addCommand(profiles);

// ── Parse argv and run ───────────────────────────────────────────────────────
program.parse(process.argv);

// If no arguments were provided at all, print help
if (process.argv.length <= 2) {
  program.help();
}
