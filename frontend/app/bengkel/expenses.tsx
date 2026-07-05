/**
 * Bengkel Expenses — alias for /finance/expenses
 *
 * This route is registered as /bengkel/expenses in APP_ROUTES
 * for contextual navigation from the Bengkel menu.
 * Explicit default export (re-export breaks expo-router on Hermes release builds).
 */
import ExpensesScreen from '../finance/expenses/index';

export default ExpensesScreen;
