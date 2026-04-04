const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  createAssignment,
  getAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentSubmissions,
  getAnalytics
} = require('../controllers/assignmentController');

router.get('/analytics', protect, authorize('teacher'), getAnalytics);

router.route('/')
  .get(protect, getAssignments)
  .post(protect, authorize('teacher'), createAssignment);

router.route('/:id')
  .get(protect, getAssignment)
  .put(protect, authorize('teacher'), updateAssignment)
  .delete(protect, authorize('teacher'), deleteAssignment);

router.get('/:id/submissions', protect, authorize('teacher'), getAssignmentSubmissions);

module.exports = router;
