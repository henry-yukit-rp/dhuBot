const axios = require("axios");
const fs = require("fs");
const dayjs = require("dayjs");
const FormData = require("form-data");

const PH_UNBILLABLE_EXPENSES_PROJECT_ID = 45414040;
const EXPENSE_CATEGORY_TRANSPORTATION = 4264709;
const EXPENSE_CATEGORY_OTHER = 4264710;

const addExpense = async (expenseData) => {
    const URL = "https://api.harvestapp.com/v2/expenses";

    const { userToken, accountId, expenseCategory, expenseDate, totalCost, notes, filePath } = expenseData;

    const formData = new FormData();

    formData.append('project_id', PH_UNBILLABLE_EXPENSES_PROJECT_ID);
    formData.append('expense_category_id', expenseCategory === "transportation" ? EXPENSE_CATEGORY_TRANSPORTATION : EXPENSE_CATEGORY_OTHER);
    formData.append('spent_date', expenseDate === "TODAY" ? dayjs().format('YYYY-MM-DD') : dayjs(expenseDate).format('YYYY-MM-DD'));
    formData.append('units', '1');
    formData.append('total_cost', totalCost);
    formData.append('notes', notes || '');
    formData.append('billable', 'false');

    if (filePath) {
        formData.append('receipt', fs.createReadStream(filePath));
    }

    try {
        const response = await axios.post(URL, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${userToken}`,
                'Harvest-Account-ID': accountId,
            },
        });

        return {
            success: true,
            data: response.data,
            message: 'Expense added successfully'
        };
    } catch (error) {
        if (error.response) {
            // Harvest API returned an error
            const status = error.response.status;
            const errorData = error.response.data;

            if (status === 401) {
                return {
                    success: false,
                    error: 'unauthorized',
                    message: 'Invalid or expired Harvest credentials. Please run `/configure` to update your credentials.'
                };
            } else if (status === 403) {
                return {
                    success: false,
                    error: 'forbidden',
                    message: 'You do not have permission to add expenses. Please check your Harvest account permissions.'
                };
            } else if (status === 422) {
                return {
                    success: false,
                    error: 'validation',
                    message: `Validation error: ${errorData.message || 'Invalid expense data'}`
                };
            } else if (status === 429) {
                return {
                    success: false,
                    error: 'rate_limit',
                    message: 'Too many requests. Please try again later.'
                };
            } else {
                return {
                    success: false,
                    error: 'api_error',
                    message: `Harvest API error (${status}): ${errorData.message || 'Unknown error'}`
                };
            }
        } else if (error.code === 'ENOENT') {
            return {
                success: false,
                error: 'file_not_found',
                message: 'Receipt file not found.'
            };
        } else {
            return {
                success: false,
                error: 'network',
                message: 'Network error. Please check your connection and try again.'
            };
        }
    }
};

module.exports = {
    addExpense,
};
