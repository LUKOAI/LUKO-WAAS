/**
 * WAAS Task Manager Module
 * Zarządzanie zadaniami i kolejką
 */

const TaskType = {
  INSTALL_DIVI: 'Install Divi',
  INSTALL_PLUGIN: 'Install Plugin',
  IMPORT_PRODUCTS: 'Import Products',
  UPDATE_PRODUCTS: 'Update Products',
  GENERATE_CONTENT: 'Generate Content',
  PUBLISH_CONTENT: 'Publish Content',
  CHECK_SITE: 'Check Site'
};

const TaskStatus = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
};

const TaskPriority = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent'
};

// =============================================================================
// OPERACJE NA ZADANIACH
// =============================================================================

function createTask(taskType, siteId, productIds = '', priority = TaskPriority.MEDIUM, scheduledDate = null) {
  const sheet = getTasksSheet();
  const id = getNextId('Tasks');

  sheet.appendRow([
    id,
    taskType,
    siteId,
    productIds,
    TaskStatus.PENDING,
    priority,
    scheduledDate || new Date(),
    '',
    '',
    '',
    '',
    new Date(),
    ''
  ]);

  logInfo('TaskManager', `Task created: ${taskType} (ID: ${id})`, siteId, id);
  return id;
}

function getTaskById(taskId) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === taskId) {
      return {
        id: data[i][0],
        taskType: data[i][1],
        siteId: data[i][2],
        productIds: data[i][3],
        status: data[i][4],
        priority: data[i][5],
        scheduledDate: data[i][6],
        startedDate: data[i][7],
        completedDate: data[i][8],
        result: data[i][9],
        errorMessage: data[i][10],
        createdDate: data[i][11],
        notes: data[i][12],
        rowIndex: i + 1
      };
    }
  }

  return null;
}

function updateTaskStatus(taskId, status, result = '', errorMessage = '') {
  const task = getTaskById(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const sheet = getTasksSheet();
  const row = task.rowIndex;

  // Aktualizuj status
  sheet.getRange(row, 5).setValue(status);

  // Aktualizuj daty
  if (status === TaskStatus.RUNNING && !task.startedDate) {
    sheet.getRange(row, 8).setValue(new Date());
  }
  if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED) {
    sheet.getRange(row, 9).setValue(new Date());
  }

  // Aktualizuj wynik
  if (result) {
    sheet.getRange(row, 10).setValue(result);
  }
  if (errorMessage) {
    sheet.getRange(row, 11).setValue(errorMessage);
  }

  logInfo('TaskManager', `Task ${taskId} status: ${status}`, task.siteId, taskId);
}

// =============================================================================
// KOLEJKA ZADAŃ
// =============================================================================

function getPendingTasks(limit = 10) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();

  const now = new Date();
  const tasks = [];

  for (let i = 1; i < data.length && tasks.length < limit; i++) {
    if (data[i][4] === TaskStatus.PENDING && new Date(data[i][6]) <= now) {
      tasks.push({
        id: data[i][0],
        taskType: data[i][1],
        siteId: data[i][2],
        productIds: data[i][3],
        priority: data[i][5]
      });
    }
  }

  // Sortuj po priorytecie
  const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return tasks;
}

function runTaskQueue() {
  try {
    logInfo('TaskManager', 'Starting task queue processing');

    const tasks = getPendingTasks(WAAS_CONFIG.limits.maxTasksPerRun);

    if (tasks.length === 0) {
      SpreadsheetApp.getUi().alert(
        'Task Queue',
        'No pending tasks to process',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return 0;
    }

    let processed = 0;
    let failed = 0;

    tasks.forEach(task => {
      try {
        executeTask(task);
        processed++;
      } catch (error) {
        logError('TaskManager', `Task execution failed: ${error.message}`, task.siteId, task.id);
        updateTaskStatus(task.id, TaskStatus.FAILED, '', error.message);
        failed++;
      }
    });

    logSuccess('TaskManager', `Processed ${processed} tasks (${failed} failed)`);

    SpreadsheetApp.getUi().alert(
      'Task Queue Complete',
      `Processed: ${processed}\nFailed: ${failed}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return processed;
  } catch (error) {
    handleError(error, 'TaskManager.runTaskQueue');
    return 0;
  }
}

function executeTask(task) {
  logInfo('TaskManager', `Executing task: ${task.taskType}`, task.siteId, task.id);

  updateTaskStatus(task.id, TaskStatus.RUNNING);

  try {
    let result;

    switch (task.taskType) {
      case TaskType.INSTALL_DIVI:
        result = installDiviOnSite(task.siteId);
        break;

      case TaskType.INSTALL_PLUGIN:
        result = installPluginOnSite(task.siteId);
        break;

      case TaskType.CHECK_SITE:
        result = checkSiteStatus(task.siteId);
        break;

      case TaskType.IMPORT_PRODUCTS:
        // Parse product IDs from string
        const importData = JSON.parse(task.productIds || '{}');
        result = importProductsFromAmazon(importData);
        break;

      case TaskType.UPDATE_PRODUCTS:
        result = updateProductData();
        break;

      case TaskType.GENERATE_CONTENT:
        // Parse content data
        const contentData = JSON.parse(task.productIds || '{}');
        result = generateContentForSite(task.siteId, contentData);
        break;

      case TaskType.PUBLISH_CONTENT:
        result = publishScheduledContent();
        break;

      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }

    updateTaskStatus(task.id, TaskStatus.COMPLETED, JSON.stringify(result));
    logSuccess('TaskManager', `Task completed: ${task.taskType}`, task.siteId, task.id);

  } catch (error) {
    updateTaskStatus(task.id, TaskStatus.FAILED, '', error.message);
    throw error;
  }
}

function retryFailedTasks() {
  try {
    const sheet = getTasksSheet();
    const data = sheet.getDataRange().getValues();

    let retried = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === TaskStatus.FAILED) {
        const taskId = data[i][0];
        sheet.getRange(i + 1, 5).setValue(TaskStatus.PENDING);
        sheet.getRange(i + 1, 11).setValue(''); // Clear error message
        retried++;
      }
    }

    logInfo('TaskManager', `Retried ${retried} failed tasks`);

    SpreadsheetApp.getUi().alert(
      'Retry Tasks',
      `${retried} failed tasks have been reset to pending`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return retried;
  } catch (error) {
    handleError(error, 'TaskManager.retryFailedTasks');
    return 0;
  }
}

// =============================================================================
// SCHEDULED TASKS
// =============================================================================

function scheduleTask(taskType, siteId, productIds, scheduledDate, priority = TaskPriority.MEDIUM) {
  return createTask(taskType, siteId, productIds, priority, scheduledDate);
}

function scheduleDailyTasks() {
  // Ta funkcja może być uruchamiana przez trigger czasowy

  logInfo('TaskManager', 'Scheduling daily tasks');

  const sites = getAllActiveSites();

  sites.forEach(site => {
    // Sprawdź status strony
    createTask(TaskType.CHECK_SITE, site.id, '', TaskPriority.LOW);
  });

  // Aktualizuj produkty
  createTask(TaskType.UPDATE_PRODUCTS, '', '', TaskPriority.MEDIUM);

  logSuccess('TaskManager', `Scheduled ${sites.length + 1} daily tasks`);
}

// =============================================================================
// HELPERS
// =============================================================================

function getTaskStats() {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();

  const stats = {
    total: data.length - 1,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0
  };

  for (let i = 1; i < data.length; i++) {
    const status = data[i][4];
    stats[status.toLowerCase()]++;
  }

  return stats;
}
