using Microsoft.EntityFrameworkCore;
using Models;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Model> Models { get; set; } = null!;
    public DbSet<ModelSpecification> ModelSpecifications { get; set; } = null!;
    public DbSet<Product> Products { get; set; } = null!;
    public DbSet<Measurement> Measurements { get; set; } = null!;
    public DbSet<ModelImage> ModelImages { get; set; } = null!;
    public DbSet<ActionHistory> ActionHistories { get; set; } = null!;
    public DbSet<Equip> Equips { get; set; } = null!;
    public DbSet<ModelDocument> ModelDocuments { get; set; }
    public DbSet<User> Users { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure indexes with SQL Server specific options
        modelBuilder.Entity<Model>()
            .HasIndex(m => m.PartNo)
            .IsUnique()
            .IsClustered(false);

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.MeasurementDate)
            .IsClustered(false);

        modelBuilder.Entity<Measurement>()
            .HasIndex(m => m.MeasuredAt)
            .IsClustered(false);

        // Relationships
        modelBuilder.Entity<ModelSpecification>()
            .HasOne(ms => ms.Model)
            .WithMany(m => m.Specifications)
            .HasForeignKey(ms => ms.ModelId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Model)
            .WithMany(m => m.Products)
            .HasForeignKey(p => p.ModelId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Measurement>()
            .HasOne(m => m.Product)
            .WithMany(p => p.Measurements)
            .HasForeignKey(m => m.ProductId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Measurement>()
            .HasOne(m => m.Specification)
            .WithMany()
            .HasForeignKey(m => m.SpecId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ModelImage>()
            .HasOne(i => i.Model)
            .WithMany(m => m.Images)
            .HasForeignKey(i => i.ModelId)
            .OnDelete(DeleteBehavior.Cascade);

        // Add unique index on Username
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // Add default admin user
        modelBuilder.Entity<User>().HasData(
            new User
            {
                UserId = 1,
                Username = "admin",
                // In production, use proper password hashing
                Password = "admin123",
                FullName = "Administrator",
                RoleType = UserRole.Admin,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        );
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.EnableDetailedErrors();
        optionsBuilder.EnableSensitiveDataLogging();
        
        base.OnConfiguring(optionsBuilder);
    }
} 