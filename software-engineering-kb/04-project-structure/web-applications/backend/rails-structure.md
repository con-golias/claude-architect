# Ruby on Rails Project Structure

> **AI Plugin Directive:** When generating a Ruby on Rails project, ALWAYS follow Rails conventions. Apply Convention over Configuration — use the standard directory layout, generators, and naming patterns. This guide covers Rails 7.1+ with Hotwire, ImportMaps, and modern patterns.

**Core Rule: Follow Rails conventions EXACTLY. The framework rewards convention compliance and punishes deviation. NEVER reorganize the standard Rails directory structure. Use generators to create files in their correct locations.**

---

## 1. Standard Rails Project Structure

```
my-app/
├── app/                           # Core application code
│   ├── assets/                    # Asset pipeline (Propshaft/Sprockets)
│   │   ├── stylesheets/
│   │   └── images/
│   │
│   ├── channels/                  # Action Cable channels
│   │   └── application_cable/
│   │       ├── channel.rb
│   │       └── connection.rb
│   │
│   ├── controllers/               # Request handlers
│   │   ├── application_controller.rb
│   │   ├── concerns/              # Controller mixins
│   │   │   ├── authentication.rb
│   │   │   └── pagination.rb
│   │   ├── users_controller.rb
│   │   └── api/                   # API namespace
│   │       └── v1/
│   │           ├── base_controller.rb
│   │           ├── users_controller.rb
│   │           └── items_controller.rb
│   │
│   ├── helpers/                   # View helpers
│   │   └── application_helper.rb
│   │
│   ├── javascript/                # Hotwire + Stimulus (importmap)
│   │   ├── application.js
│   │   └── controllers/           # Stimulus controllers
│   │       ├── index.js
│   │       ├── hello_controller.js
│   │       └── modal_controller.js
│   │
│   ├── jobs/                      # Active Job background jobs
│   │   ├── application_job.rb
│   │   └── send_email_job.rb
│   │
│   ├── mailers/                   # Action Mailer
│   │   ├── application_mailer.rb
│   │   └── user_mailer.rb
│   │
│   ├── models/                    # Active Record models
│   │   ├── application_record.rb
│   │   ├── concerns/              # Model mixins
│   │   │   ├── searchable.rb
│   │   │   ├── sluggable.rb
│   │   │   └── auditable.rb
│   │   ├── user.rb
│   │   ├── post.rb
│   │   └── comment.rb
│   │
│   ├── policies/                  # Pundit authorization policies
│   │   ├── application_policy.rb
│   │   └── user_policy.rb
│   │
│   ├── serializers/               # API response formatting (AMS/Blueprinter)
│   │   ├── user_serializer.rb
│   │   └── post_serializer.rb
│   │
│   ├── services/                  # Service objects (business logic)
│   │   ├── users/
│   │   │   ├── create_service.rb
│   │   │   ├── update_service.rb
│   │   │   └── deactivate_service.rb
│   │   └── payments/
│   │       └── process_service.rb
│   │
│   └── views/                     # ERB/Slim templates
│       ├── layouts/
│       │   └── application.html.erb
│       ├── shared/                 # Partials used across views
│       │   ├── _navbar.html.erb
│       │   └── _flash.html.erb
│       ├── users/
│       │   ├── index.html.erb
│       │   ├── show.html.erb
│       │   ├── new.html.erb
│       │   ├── edit.html.erb
│       │   └── _form.html.erb     # Partial (underscore prefix)
│       └── api/                    # Jbuilder JSON templates (optional)
│           └── v1/
│               └── users/
│                   ├── index.json.jbuilder
│                   └── show.json.jbuilder
│
├── bin/                           # Binstubs
│   ├── rails
│   ├── rake
│   ├── setup                      # Project setup script
│   └── dev                        # Development startup
│
├── config/                        # Configuration
│   ├── application.rb             # App-level config
│   ├── boot.rb
│   ├── cable.yml                  # Action Cable config
│   ├── database.yml               # Database config (per environment)
│   ├── environment.rb
│   ├── environments/
│   │   ├── development.rb
│   │   ├── test.rb
│   │   └── production.rb
│   ├── importmap.rb               # JavaScript import maps
│   ├── initializers/              # Startup configuration
│   │   ├── cors.rb
│   │   ├── devise.rb
│   │   ├── filter_parameter_logging.rb
│   │   └── sidekiq.rb
│   ├── locales/                   # I18n translations
│   │   └── en.yml
│   ├── routes.rb                  # URL routing
│   ├── storage.yml                # Active Storage config
│   └── credentials.yml.enc       # Encrypted secrets
│
├── db/                            # Database
│   ├── migrate/                   # Migration files (timestamped)
│   │   ├── 20240101000000_create_users.rb
│   │   └── 20240102000000_create_posts.rb
│   ├── schema.rb                  # Auto-generated schema snapshot
│   └── seeds.rb                   # Database seed data
│
├── lib/                           # Non-app Ruby code
│   ├── tasks/                     # Custom Rake tasks
│   │   └── data_migration.rake
│   └── extensions/                # Ruby extensions
│
├── log/                           # Log files (gitignored)
├── public/                        # Static files served directly
├── storage/                       # Active Storage uploads
├── tmp/                           # Temp files, cache, PIDs
├── vendor/                        # Third-party code
│
├── test/  (or spec/)              # Tests
│   ├── test_helper.rb             # (or spec/rails_helper.rb for RSpec)
│   ├── models/
│   │   └── user_test.rb
│   ├── controllers/
│   │   └── users_controller_test.rb
│   ├── integration/
│   │   └── user_flows_test.rb
│   ├── system/                    # System/E2E tests
│   │   └── user_management_test.rb
│   ├── services/
│   │   └── users/
│   │       └── create_service_test.rb
│   ├── factories/                 # FactoryBot factories
│   │   ├── users.rb
│   │   └── posts.rb
│   └── fixtures/
│       └── files/                 # Test file uploads
│
├── .ruby-version                  # Ruby version
├── Gemfile                        # Dependencies
├── Gemfile.lock
├── Rakefile
├── Dockerfile
├── docker-compose.yml
└── Procfile                       # Process manager
```

---

## 2. Naming Conventions (CRITICAL)

| Type | Convention | Example |
|------|-----------|---------|
| Model | Singular, PascalCase | `User`, `BlogPost` |
| Table | Plural, snake_case | `users`, `blog_posts` |
| Controller | Plural, PascalCase + Controller | `UsersController` |
| File | snake_case | `user.rb`, `users_controller.rb` |
| Route helper | snake_case | `users_path`, `edit_user_path(user)` |
| Migration | Descriptive timestamp | `20240101_create_users.rb` |
| Service | Verb + noun + Service | `Users::CreateService` |
| Job | Verb + noun + Job | `SendWelcomeEmailJob` |
| Mailer | Noun + Mailer | `UserMailer` |
| Concern | Adjective / -able | `Searchable`, `Auditable` |
| Serializer | Noun + Serializer | `UserSerializer` |
| Policy | Noun + Policy | `UserPolicy` |

---

## 3. Generators (Use Them)

```bash
# Model (creates model, migration, test, factory)
rails generate model User email:string:uniq full_name:string role:integer

# Controller
rails generate controller Users index show new create edit update destroy

# Scaffold (full CRUD — model, controller, views, routes, tests)
rails generate scaffold Post title:string body:text user:references

# Migration
rails generate migration AddRoleToUsers role:integer:default{0}
rails generate migration CreateJoinTableUsersRoles users roles

# Job
rails generate job SendWelcomeEmail

# Mailer
rails generate mailer User welcome reset_password

# Channel (Action Cable)
rails generate channel Notification

# Stimulus controller
rails generate stimulus modal

# Destroy (undo any generator)
rails destroy model User
```

---

## 4. Routes Configuration

```ruby
# config/routes.rb
Rails.application.routes.draw do
  # Root
  root "pages#home"

  # RESTful resources
  resources :users do
    member do
      patch :deactivate
      patch :activate
    end
    collection do
      get :search
    end
  end

  resources :posts do
    resources :comments, only: [:create, :destroy]
  end

  # API namespace
  namespace :api do
    namespace :v1 do
      resources :users, only: [:index, :show, :create, :update, :destroy]
      resources :posts, only: [:index, :show, :create]
      resource :auth, only: [] do
        post :login
        post :register
        delete :logout
      end
    end
  end

  # Health check
  get "up" => "rails/health#show", as: :rails_health_check

  # Sidekiq dashboard (admin only)
  require "sidekiq/web"
  authenticate :user, ->(u) { u.admin? } do
    mount Sidekiq::Web => "/sidekiq"
  end
end
```

---

## 5. Controllers

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  include Authentication
  include Pagination

  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from ActiveRecord::RecordInvalid, with: :unprocessable_entity

  private

  def not_found
    render json: { error: "Not found" }, status: :not_found
  end

  def unprocessable_entity(exception)
    render json: { errors: exception.record.errors.full_messages },
           status: :unprocessable_entity
  end
end


# app/controllers/users_controller.rb
class UsersController < ApplicationController
  before_action :set_user, only: [:show, :edit, :update, :destroy]
  before_action :authorize_user!, only: [:edit, :update, :destroy]

  def index
    @users = User.active.order(created_at: :desc).page(params[:page])
  end

  def show; end

  def new
    @user = User.new
  end

  def create
    result = Users::CreateService.call(user_params)
    if result.success?
      redirect_to result.user, notice: "User created successfully"
    else
      @user = result.user
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @user.update(user_params)
      redirect_to @user, notice: "User updated successfully"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @user.destroy
    redirect_to users_path, notice: "User deleted"
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.require(:user).permit(:email, :full_name, :role)
  end

  def authorize_user!
    authorize @user  # Pundit
  end
end
```

### API Controller Pattern

```ruby
# app/controllers/api/v1/base_controller.rb
module Api
  module V1
    class BaseController < ActionController::API
      include ActionController::HttpAuthentication::Token::ControllerMethods

      before_action :authenticate_api_user!

      rescue_from ActiveRecord::RecordNotFound do |e|
        render json: { error: e.message }, status: :not_found
      end

      rescue_from ActiveRecord::RecordInvalid do |e|
        render json: { errors: e.record.errors }, status: :unprocessable_entity
      end

      private

      def authenticate_api_user!
        authenticate_or_request_with_http_token do |token, _options|
          @current_user = User.find_by(api_token: token)
        end
      end

      def current_user
        @current_user
      end
    end
  end
end


# app/controllers/api/v1/users_controller.rb
module Api
  module V1
    class UsersController < BaseController
      def index
        users = User.active.order(created_at: :desc).page(params[:page])
        render json: UserSerializer.new(users).serializable_hash
      end

      def show
        user = User.find(params[:id])
        render json: UserSerializer.new(user).serializable_hash
      end

      def create
        result = Users::CreateService.call(user_params)
        if result.success?
          render json: UserSerializer.new(result.user).serializable_hash,
                 status: :created
        else
          render json: { errors: result.errors }, status: :unprocessable_entity
        end
      end

      private

      def user_params
        params.require(:user).permit(:email, :full_name, :password)
      end
    end
  end
end
```

---

## 6. Models

```ruby
# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
end


# app/models/user.rb
class User < ApplicationRecord
  # Associations
  has_many :posts, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_one :profile, dependent: :destroy

  # Validations
  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :full_name, presence: true, length: { maximum: 100 }
  validates :role, inclusion: { in: %w[user admin moderator] }

  # Enums
  enum :role, { user: 0, admin: 1, moderator: 2 }, default: :user

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :admins, -> { where(role: :admin) }
  scope :recent, -> { order(created_at: :desc) }
  scope :search, ->(query) {
    where("full_name ILIKE :q OR email ILIKE :q", q: "%#{query}%")
  }

  # Callbacks (use sparingly)
  before_save :downcase_email
  after_create :send_welcome_email

  # Secure password (bcrypt)
  has_secure_password

  private

  def downcase_email
    self.email = email.downcase
  end

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end
```

---

## 7. Concerns (Mixins)

```ruby
# app/models/concerns/searchable.rb
module Searchable
  extend ActiveSupport::Concern

  included do
    scope :search, ->(query) {
      return all if query.blank?

      columns = searchable_columns.map { |col| "#{col} ILIKE :q" }.join(" OR ")
      where(columns, q: "%#{query}%")
    }
  end

  class_methods do
    def searchable_columns
      raise NotImplementedError, "Define searchable_columns in #{name}"
    end
  end
end


# app/models/concerns/sluggable.rb
module Sluggable
  extend ActiveSupport::Concern

  included do
    before_validation :generate_slug, on: :create
    validates :slug, presence: true, uniqueness: true
  end

  def to_param
    slug
  end

  private

  def generate_slug
    self.slug = title.parameterize if slug.blank? && respond_to?(:title)
  end
end


# Usage in model:
class Post < ApplicationRecord
  include Searchable
  include Sluggable

  def self.searchable_columns
    %w[title body]
  end
end
```

---

## 8. Service Objects

```ruby
# app/services/application_service.rb
class ApplicationService
  def self.call(...)
    new(...).call
  end
end


# app/services/users/create_service.rb
module Users
  class CreateService < ApplicationService
    attr_reader :user, :errors

    def initialize(params)
      @params = params
      @errors = []
    end

    def call
      @user = User.new(@params)

      ActiveRecord::Base.transaction do
        @user.save!
        create_default_profile!
        send_notifications!
      end

      OpenStruct.new(success?: true, user: @user)
    rescue ActiveRecord::RecordInvalid => e
      @errors = e.record.errors.full_messages
      OpenStruct.new(success?: false, user: @user, errors: @errors)
    end

    private

    def create_default_profile!
      @user.create_profile!(bio: "", avatar_url: nil)
    end

    def send_notifications!
      UserMailer.welcome(@user).deliver_later
      AdminNotificationJob.perform_later(@user.id)
    end
  end
end
```

### Service Object Rules

| Rule | Description |
|------|------------|
| Single responsibility | One service = one business operation |
| `.call` class method | ALWAYS use `self.call(...)` entry point |
| Return result object | Return success/failure with data, NEVER raise for business errors |
| Wrap in transaction | Use `ActiveRecord::Base.transaction` for multi-step operations |
| Namespace by feature | `Users::CreateService`, `Payments::ProcessService` |
| No controller logic | Services do NOT access `params`, `session`, or `request` |

---

## 9. Background Jobs

```ruby
# app/jobs/application_job.rb
class ApplicationJob < ActiveJob::Base
  retry_on StandardError, wait: :polynomially_longer, attempts: 5
  discard_on ActiveJob::DeserializationError
end


# app/jobs/send_welcome_email_job.rb
class SendWelcomeEmailJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find(user_id)
    UserMailer.welcome(user).deliver_now
  end
end

# Usage: SendWelcomeEmailJob.perform_later(user.id)
# NEVER pass Active Record objects — pass IDs only
```

---

## 10. Database Migrations

```ruby
# db/migrate/20240101000000_create_users.rb
class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :full_name, null: false
      t.string :password_digest, null: false
      t.integer :role, default: 0, null: false
      t.boolean :is_active, default: true, null: false

      t.timestamps
    end

    add_index :users, :email, unique: true
    add_index :users, :role
  end
end

# Migration commands:
# rails db:migrate
# rails db:rollback
# rails db:migrate:status
# rails db:seed
# rails db:reset (drop + create + migrate + seed)
```

---

## 11. Testing (RSpec)

```ruby
# spec/rails_helper.rb
require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rspec/rails"

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.include FactoryBot::Syntax::Methods
  config.include Devise::Test::IntegrationHelpers, type: :request
end


# spec/models/user_spec.rb
RSpec.describe User, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_uniqueness_of(:email).case_insensitive }
    it { is_expected.to validate_presence_of(:full_name) }
  end

  describe "associations" do
    it { is_expected.to have_many(:posts).dependent(:destroy) }
  end

  describe "scopes" do
    it ".active returns only active users" do
      active = create(:user, is_active: true)
      _inactive = create(:user, is_active: false)
      expect(User.active).to eq([active])
    end
  end
end


# spec/requests/api/v1/users_spec.rb
RSpec.describe "Api::V1::Users", type: :request do
  let(:user) { create(:user) }
  let(:headers) { { "Authorization" => "Token #{user.api_token}" } }

  describe "GET /api/v1/users" do
    it "returns paginated users" do
      create_list(:user, 3)
      get "/api/v1/users", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_response["data"].size).to eq(4)
    end
  end

  describe "POST /api/v1/users" do
    it "creates a new user" do
      post "/api/v1/users",
           params: { user: attributes_for(:user) },
           headers: headers
      expect(response).to have_http_status(:created)
    end
  end
end


# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    email { Faker::Internet.unique.email }
    full_name { Faker::Name.name }
    password { "securepassword123" }
    role { :user }
    is_active { true }

    trait :admin do
      role { :admin }
    end

    trait :inactive do
      is_active { false }
    end
  end
end
```

---

## 12. Credentials and Secrets

```bash
# Edit credentials (opens in $EDITOR)
rails credentials:edit

# Edit environment-specific credentials
rails credentials:edit --environment production

# Access in code:
Rails.application.credentials.secret_key_base
Rails.application.credentials.dig(:aws, :access_key_id)
```

```yaml
# config/credentials.yml.enc (decrypted)
secret_key_base: abc123...
aws:
  access_key_id: AKIA...
  secret_access_key: ...
stripe:
  publishable_key: pk_live_...
  secret_key: sk_live_...
```

---

## 13. Essential Gems

```ruby
# Gemfile
source "https://rubygems.org"

ruby "3.3.0"

gem "rails", "~> 7.1"
gem "pg"                        # PostgreSQL
gem "puma"                      # Web server
gem "redis"                     # Cache + Action Cable + Sidekiq

# Authentication & Authorization
gem "devise"                    # Authentication
gem "pundit"                    # Authorization policies

# API
gem "jsonapi-serializer"        # JSON:API serialization
gem "pagy"                      # Pagination (faster than kaminari)
gem "rack-cors"                 # CORS

# Background Jobs
gem "sidekiq"                   # Background processing
gem "sidekiq-cron"              # Scheduled jobs

# Frontend
gem "importmap-rails"           # JavaScript with importmaps
gem "turbo-rails"               # Hotwire Turbo
gem "stimulus-rails"            # Hotwire Stimulus
gem "tailwindcss-rails"         # Tailwind CSS

group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
  gem "faker"
  gem "rubocop-rails", require: false
  gem "debug"
end

group :test do
  gem "shoulda-matchers"
  gem "capybara"
  gem "selenium-webdriver"
end
```

---

## 14. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Fat controllers | 100+ line controller actions | Extract to service objects |
| Fat models | 500+ line models | Use concerns and service objects |
| Skipping generators | Manual file creation, wrong naming | ALWAYS use `rails generate` |
| N+1 queries | Slow pages, too many SQL queries | Use `includes()`, `eager_load()`, bullet gem |
| Callbacks for business logic | Hidden side effects, test complexity | Move to service objects, use callbacks only for data integrity |
| String-based queries | SQL injection vulnerability | Use parameterized queries, scopes |
| No service layer | Complex logic in controllers | Create `app/services/` directory from day one |
| Testing with fixtures only | Brittle tests tied to static data | Use FactoryBot with traits |
| Hardcoded secrets | Secrets in source code | Use `rails credentials:edit` |
| Ignoring `schema.rb` | Merge conflicts, drift | ALWAYS commit `schema.rb`, resolve conflicts carefully |

---

## 15. Enforcement Checklist

- [ ] Standard Rails directory structure — NEVER reorganize app/ subdirectories
- [ ] ALL models, controllers, jobs created via `rails generate`
- [ ] Naming follows Rails conventions exactly (plural controllers, singular models)
- [ ] Routes use `resources` — NEVER manually define CRUD routes
- [ ] Service objects handle complex business logic — controllers are thin
- [ ] Concerns used for shared model/controller behavior
- [ ] `has_secure_password` or Devise for authentication — NEVER roll custom auth
- [ ] Pundit policies for authorization — checked in every controller action
- [ ] RSpec + FactoryBot for testing — factories over fixtures
- [ ] Sidekiq for background jobs — NEVER pass AR objects, pass IDs
- [ ] Credentials encrypted via `rails credentials:edit`
- [ ] Database constraints match model validations (NOT NULL, unique index)
- [ ] Migrations are reversible — define `up`/`down` or use `change`
- [ ] `schema.rb` committed and up to date
- [ ] Rubocop configured and passing
