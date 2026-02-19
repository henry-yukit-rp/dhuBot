const axios = require("axios");
const fs = require("fs");
const dayjs = require("dayjs");
const FormData = require("form-data");

const PH_UNBILLABLE_EXPENSES_PROJECT_ID = 45414040;
const EXPENSE_CATEGORY_TRANSPORTATION = 4264709;
const EXPENSE_CATEGORY_OTHER = 4264710;
const URL = "https://api.harvestapp.com/v2/expenses";
const RP_CLIENT_ID = 16078381;
const RP_PROJECT_ID = 45414040;

const addExpense = async (expenseData) => {
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
        console.log('Harvest: Attempting to read file:', filePath);
        if (!fs.existsSync(filePath)) {
            console.error('Harvest: File does not exist at path:', filePath);
            return {
                success: false,
                error: 'file_not_found',
                message: `Receipt file not found: ${filePath}`
            };
        }
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

function getMidpointDate(date = dayjs()) {                                                                                                                                                                                        
    const fifteenth = date.date(15);                                                                                                                                                                                                
    const dayOfWeek = fifteenth.day(); // 0 = Sunday, 6 = Saturday                                                                                                                                                                  

    if (dayOfWeek === 0) {
        // Sunday -> move to Monday (16th)
        return 13;
    } else if (dayOfWeek === 6) {
        // Saturday -> move to Friday (14th)
        return 14;
    }
    return 15;
}

const getCurrentReimbursements = async (userToken, accountId) => {
    const midPoint = getMidpointDate();
    const isFirstCutoff = dayjs().date() <= midPoint;

    // First cutoff: 1st to midpoint | Second cutoff: midpoint+1 to end of month
    const startDate = isFirstCutoff ? dayjs().startOf('month') : dayjs().date(midPoint + 1);
    const endDate = isFirstCutoff ? dayjs().date(midPoint) : dayjs().endOf('month');

    let CURRENT_TRANSPORTATION_USAGE = 0;
    let CURRENT_WELLNESS_USAGE = 0;

    const response = await axios.get(`${URL}?from=${dayjs(startDate).format("YYYY-MM-DD")}&to=${dayjs(endDate).format("YYYY-MM-DD")}`, {
        headers: {
            'Authorization': `Bearer ${userToken}`,
            'Harvest-Account-ID': accountId,
        }
    });

    const expenses = response.data.expenses;

    expenses.forEach((expense) => {
        if (expense.client.id === RP_CLIENT_ID && expense.project.id === RP_PROJECT_ID) {
            if (expense.expense_category.id === EXPENSE_CATEGORY_TRANSPORTATION) CURRENT_TRANSPORTATION_USAGE += expense.total_cost;
            else if (expense.expense_category.id === EXPENSE_CATEGORY_OTHER) CURRENT_WELLNESS_USAGE += expense.total_cost;
        }
    });

    return { transportation: CURRENT_TRANSPORTATION_USAGE, wellness: CURRENT_WELLNESS_USAGE };
};

module.exports = {
    addExpense,
    getCurrentReimbursements,
    getMidpointDate,
};
