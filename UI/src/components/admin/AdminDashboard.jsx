import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Users,
  TrendingUp,
  Settings,
  Trash2,
  Edit2,
  Save,
  X,
  MessageSquare,
  UserCog,
  Database,
  Activity,
  ArrowLeft,
  FileText,
  Upload,
  BarChart3,
  ImagePlus,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { DocumentUpload } from './DocumentUpload';
import { IngestionMonitor } from './IngestionMonitor';
import { DocumentList } from './DocumentList';
import { TrendingSearches } from './TrendingSearches';
import { HealthCheck } from './HealthCheck';
import { ArchitectureImageUpload } from './ArchitectureImageUpload';
import { DocumentValidation } from './DocumentValidation';

export function AdminDashboard({ onNavigate }) {
  const { getAllUsers, updateUser, deleteUser, getAppStats, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalSessions: 0, activeUsers: 0 });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('users'); 

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const allUsers = getAllUsers();
      setUsers(allUsers);
      const appStats = getAppStats();
      setStats(appStats);
    } catch (err) {
      setError('Failed to load data');
    }
  };

  const handleEdit = (user) => {
    setEditingUserId(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditForm({ name: '', email: '', role: 'user' });
    setError('');
  };

  const handleSaveEdit = async (userId) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await updateUser(userId, editForm);
      setSuccess('User updated successfully');
      setEditingUserId(null);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await deleteUser(userId);
      setSuccess('User deleted successfully');
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-950/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">Manage users and monitor CAE application</p>
              </div>
            </div>
            {onNavigate && (
              <Button
                variant="ghost"
                onClick={onNavigate}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Chat
              </Button>
            )}
          </div>
        </motion.div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/40 text-red-500"
            >
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/40 text-green-500"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-6 flex-wrap"
        >
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : ''
            }`}
          >
            <Users className="h-4 w-4" />
            User Management
          </Button>
          <Button
            variant={activeTab === 'documents' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 ${
              activeTab === 'documents'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : ''
            }`}
          >
            <FileText className="h-4 w-4" />
            Document Management
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : ''
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics & Trending
          </Button>
          <Button
            variant={activeTab === 'health' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 ${
              activeTab === 'health'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : ''
            }`}
          >
            <Activity className="h-4 w-4" />
            System Health
          </Button>
          <Button
            variant={activeTab === 'architecture' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 ${
              activeTab === 'architecture'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : ''
            }`}
          >
            <ImagePlus className="h-4 w-4" />
            Architecture Images
          </Button>
          <Button
            variant={activeTab === 'validation' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('validation')}
            className={`flex items-center gap-2 ${
              activeTab === 'validation'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : ''
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Document Validation
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-effect border-2 border-border/60 dark:border-border/40 rounded-xl p-6 shadow-lg dark:shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <span className="text-3xl font-bold">{stats.totalUsers}</span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">Total Users</h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="glass-effect border-2 border-border/60 dark:border-border/40 rounded-xl p-6 shadow-lg dark:shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Activity className="h-6 w-6 text-green-500" />
              </div>
              <span className="text-3xl font-bold">{stats.activeUsers}</span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">Active Users</h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="glass-effect border-2 border-border/60 dark:border-border/40 rounded-xl p-6 shadow-lg dark:shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-purple-500" />
              </div>
              <span className="text-3xl font-bold">{stats.totalSessions}</span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">Total Sessions</h3>
          </motion.div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'users' && (
          <>
            {/* User Management */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-effect border border-border/40 rounded-xl p-6"
            >
              <div className="flex items-center gap-2 mb-6">
                <UserCog className="h-5 w-5 text-purple-500" />
                <h2 className="text-xl font-bold">User Management</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Created</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-border/20 hover:bg-accent/5 transition-colors"
                      >
                        {editingUserId === user.id ? (
                          <>
                            <td className="py-3 px-4">
                              <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="h-8"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="h-8"
                                type="email"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={editForm.role}
                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                className="h-8 px-2 rounded-md bg-background border border-border text-sm"
                                disabled={user.email === 'xv.digvijay.shingare@singtel.com'}
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(user.id)}
                                  disabled={isLoading}
                                  className="h-8 px-3"
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  className="h-8 px-3"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="h-8 w-8 rounded-full"
                                />
                                <span className="font-medium">{user.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">{user.email}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  user.role === 'admin'
                                    ? 'bg-purple-500/10 text-purple-500'
                                    : 'bg-blue-500/10 text-blue-500'
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(user)}
                                  className="h-8 px-3"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(user.id, user.email)}
                                  disabled={user.email === 'xv.digvijay.shingare@singtel.com'}
                                  className="h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* App Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-effect border border-border/40 rounded-xl p-6 mt-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-purple-500" />
                <h2 className="text-xl font-bold">App Settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Database className="h-4 w-4 text-purple-500" />
                    Storage Information
                  </h3>
                  <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <p>• Users stored in localStorage</p>
                    <p>• Sessions expire after 21 days</p>
                    <p>• Chat history per user</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    System Status
                  </h3>
                  <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <p>• Status: <span className="text-green-600 dark:text-green-500 font-medium">Operational</span></p>
                    <p>• Backend: LLaMA 3.1 8B</p>
                    <p>• RAG Pipeline: Active</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {activeTab === 'documents' && (
          <>
            {/* Document Upload Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-effect border border-border/40 rounded-xl p-6 mb-6"
            >
              <div className="flex items-center gap-2 mb-6">
                <Upload className="h-5 w-5 text-purple-500" />
                <h2 className="text-xl font-bold">Upload Documents</h2>
              </div>
              <DocumentUpload
                onUploadComplete={() => {
                  setSuccess('Documents uploaded successfully! Run ingestion to process them.');
                  setTimeout(() => setSuccess(''), 5000);
                }}
              />
            </motion.div>

            {/* Ingestion Monitor Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-effect border border-border/40 rounded-xl p-6 mb-6"
            >
              <IngestionMonitor
                onIngestionComplete={(stats) => {
                  setSuccess(`Ingestion completed! Processed ${stats.totalDocuments} documents.`);
                  setTimeout(() => setSuccess(''), 5000);
                }}
              />
            </motion.div>

            {/* Document List Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <DocumentList onNavigateToValidation={() => setActiveTab('validation')} />
            </motion.div>
          </>
        )}

        {activeTab === 'analytics' && (
          <>
            {/* Trending Searches Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <TrendingSearches />
            </motion.div>
          </>
        )}

        {activeTab === 'health' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <HealthCheck />
          </motion.div>
        )}

        {activeTab === 'architecture' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-effect border border-border/40 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <ImagePlus className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-bold">Architecture Images</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Upload labeled architecture diagrams. Qwen2.5-VL will read the image, extract all
              components and relationships, and store them in the RAG pipeline so users can query
              the architecture.
            </p>
            <ArchitectureImageUpload
              onUploadComplete={() => {
                setSuccess('Architecture diagram ingested. Users can now query it.');
                setTimeout(() => setSuccess(''), 6000);
              }}
            />
          </motion.div>
        )}

        {activeTab === 'validation' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <DocumentValidation />
          </motion.div>
        )}
      </div>
    </div>
  );
}
